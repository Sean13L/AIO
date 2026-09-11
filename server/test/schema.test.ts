import { describe, expect, it } from "vitest";
import { syllabusExtractionSchema } from "../src/extraction/schema.js";

describe("syllabusExtractionSchema", () => {
  it("accepts a well-formed extraction", () => {
    const parsed = syllabusExtractionSchema.parse({
      course: { course_code: "CS135", course_name: "Designing Functional Programs", semester: "1A" },
      grading_scheme: [{ component: "Assignments", weight: "30%" }],
      policies: {
        late_work: "10% per day",
        attendance: null,
        academic_integrity: "No cheating",
        regrade_policy: null,
        other: null,
      },
      required_tools: ["Racket"],
      items: [
        {
          name: "Assignment 1",
          type: "assignment",
          due_date: "2026-09-20",
          due_time: null,
          is_datetime: false,
          weight: "10%",
          notes: null,
        },
      ],
      lectures: [
        {
          week_number: 1,
          scheduled_date: "2026-09-08",
          scheduled_time: "10:00",
          topics: "Intro to Racket",
        },
      ],
    });

    expect(parsed.items[0].is_datetime).toBe(false);
  });

  it("rejects an item missing a required field", () => {
    expect(() =>
      syllabusExtractionSchema.parse({
        course: { course_code: "CS135", course_name: "X", semester: null },
        grading_scheme: [],
        policies: {
          late_work: null,
          attendance: null,
          academic_integrity: null,
          regrade_policy: null,
          other: null,
        },
        required_tools: [],
        items: [{ name: "Missing fields" }],
        lectures: [],
      })
    ).toThrow();
  });
});
