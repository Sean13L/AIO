import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `mock-test-${Date.now()}@example.com`;

// Exercises the real pipeline (no vi.mock) with no ANTHROPIC_API_KEY set, so
// extractSyllabus() falls back to the local heuristic mockExtractSyllabus().
// This is the workaround path: `npm run ingest` works end-to-end today with
// zero API key. Only requires a running/migrated Postgres.
describe.skipIf(!hasDb)(
  "ingestSyllabus (offline mock-extraction workaround, requires DATABASE_URL)",
  () => {
    let pool: typeof import("../src/db/client.js").pool;

    afterAll(async () => {
      if (!pool) return;
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
      await pool.end();
    });

    it("parses the sample syllabus and persists real rows without calling the Claude API", async () => {
      expect(process.env.ANTHROPIC_API_KEY).toBeFalsy();

      const { ingestSyllabus } = await import("../src/ingest/ingestSyllabus.js");
      ({ pool } = await import("../src/db/client.js"));

      const text = fs.readFileSync(
        path.join(__dirname, "fixtures", "sample-syllabus.txt"),
        "utf8"
      );

      const result = await ingestSyllabus({
        userEmail: testEmail,
        fileUrl: "test-fixture:sample-syllabus.txt",
        input: { kind: "text", text },
      });

      expect(result.extraction.course.course_code).toBe("CS 135");
      expect(result.extraction.course.semester).toBe("1A");
      expect(result.extraction.grading_scheme).toEqual(
        expect.arrayContaining([
          { component: "Assignments", weight: "30%" },
          { component: "Midterm Exam", weight: "25%" },
          { component: "Final Exam", weight: "45%" },
        ])
      );

      // Assignment 1 has a date only -> all-day. Assignment 2 and the
      // midterm have a real time -> timed events.
      const a1 = result.extraction.items.find((i) => i.name.includes("Assignment 1"));
      const a2 = result.extraction.items.find((i) => i.name.includes("Assignment 2"));
      const midterm = result.extraction.items.find((i) => i.type === "midterm");
      expect(a1?.is_datetime).toBe(false);
      expect(a1?.due_date).toBe("2026-09-20");
      expect(a2?.is_datetime).toBe(true);
      expect(a2?.due_time).toBe("23:59");
      expect(midterm?.due_time).toBe("14:00");

      expect(result.lecturesCreated).toBeGreaterThanOrEqual(2);
      const week1 = result.extraction.lectures.find((l) => l.week_number === 1);
      expect(week1?.scheduled_date).toBe("2026-09-08");
      expect(week1?.scheduled_time).toBe("10:00");

      // And confirm it actually landed in Postgres, not just in memory.
      const dbItems = await pool.query(
        "SELECT is_datetime FROM items WHERE course_id = $1",
        [result.courseId]
      );
      expect(dbItems.rows.length).toBe(result.itemsCreated);
    });
  }
);
