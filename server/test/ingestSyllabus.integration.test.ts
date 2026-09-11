import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SyllabusExtraction } from "../src/extraction/schema.js";

const fixedExtraction: SyllabusExtraction = {
  course: {
    course_code: "CS135-TEST",
    course_name: "Designing Functional Programs (Test Fixture)",
    semester: "1A",
  },
  grading_scheme: [
    { component: "Assignments", weight: "30%" },
    { component: "Midterm Exam", weight: "25%" },
    { component: "Final Exam", weight: "45%" },
  ],
  policies: {
    late_work: "10% deducted per day late, up to 3 days.",
    attendance: null,
    academic_integrity: "All work must be your own.",
    regrade_policy: "Submit within 7 days of grades being posted.",
    other: null,
  },
  required_tools: ["Racket (DrRacket IDE)"],
  items: [
    {
      name: "Assignment 1",
      type: "assignment",
      due_date: "2026-09-20",
      due_time: null,
      is_datetime: false,
      weight: null,
      notes: null,
    },
    {
      name: "Assignment 2",
      type: "assignment",
      due_date: "2026-09-27",
      due_time: "23:59",
      is_datetime: true,
      weight: null,
      notes: null,
    },
    {
      name: "Midterm Exam",
      type: "midterm",
      due_date: "2026-10-15",
      due_time: "14:00",
      is_datetime: true,
      weight: "25%",
      notes: null,
    },
  ],
  lectures: [
    {
      week_number: 1,
      scheduled_date: "2026-09-08",
      scheduled_time: "10:00",
      topics: "Introduction to Racket, basic recursion.",
    },
    {
      week_number: 2,
      scheduled_date: "2026-09-15",
      scheduled_time: "10:00",
      topics: "Structural recursion on lists.",
    },
  ],
};

vi.mock("../src/extraction/extractSyllabus.js", () => ({
  extractSyllabus: vi.fn(async () => fixedExtraction),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `ingest-test-${Date.now()}@example.com`;

describe.skipIf(!hasDb)("ingestSyllabus (integration, requires DATABASE_URL)", () => {
  let pool: typeof import("../src/db/client.js").pool;

  beforeAll(async () => {
    ({ pool } = await import("../src/db/client.js"));
  });

  afterAll(async () => {
    await pool.query(
      "DELETE FROM users WHERE email = $1",
      [testEmail]
    ); // cascades to courses/syllabi/items/lectures via FK ON DELETE CASCADE
    await pool.end();
  });

  it("persists course, items, and lectures from an extraction", async () => {
    const { ingestSyllabus } = await import("../src/ingest/ingestSyllabus.js");

    const result = await ingestSyllabus({
      userEmail: testEmail,
      fileUrl: "test-fixture:sample-syllabus.txt",
      input: { kind: "text", text: "irrelevant — extraction is mocked" },
    });

    expect(result.itemsCreated).toBe(3);
    expect(result.lecturesCreated).toBe(2);

    const items = await pool.query(
      "SELECT name, type, due_at, is_datetime FROM items WHERE course_id = $1 ORDER BY due_at",
      [result.courseId]
    );
    expect(items.rows).toHaveLength(3);
    expect(items.rows[0].is_datetime).toBe(false);
    expect(items.rows[1].is_datetime).toBe(true);

    const lectures = await pool.query(
      "SELECT topics FROM lectures WHERE course_id = $1 ORDER BY scheduled_at",
      [result.courseId]
    );
    expect(lectures.rows).toHaveLength(2);

    const syllabi = await pool.query(
      "SELECT raw_extraction FROM syllabi WHERE id = $1",
      [result.syllabusId]
    );
    expect(syllabi.rows[0].raw_extraction.course.course_code).toBe("CS135-TEST");
  });
});
