import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hasDb = Boolean(process.env.DATABASE_URL);
const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
const testEmail = `e2e-test-${Date.now()}@example.com`;

// Full end-to-end: real Claude API call + real Postgres write. Skipped unless
// both DATABASE_URL and ANTHROPIC_API_KEY are set (e.g. local dev with .env).
describe.skipIf(!hasDb || !hasApiKey)(
  "ingestSyllabus (end-to-end, requires DATABASE_URL and ANTHROPIC_API_KEY)",
  () => {
    let pool: typeof import("../src/db/client.js").pool;

    afterAll(async () => {
      if (!pool) return;
      await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
      await pool.end();
    });

    it("extracts and persists a real syllabus via the Claude API", async () => {
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

      expect(result.extraction.course.course_code).toMatch(/CS ?135/i);
      expect(result.itemsCreated).toBeGreaterThan(0);
      expect(result.lecturesCreated).toBeGreaterThan(0);

      // The syllabus states Assignment 2 has a real time (11:59 PM) but
      // Assignment 1 does not — verify is_datetime was detected correctly.
      const a2 = result.extraction.items.find((i) =>
        i.name.toLowerCase().includes("assignment 2")
      );
      expect(a2?.is_datetime).toBe(true);

      const a1 = result.extraction.items.find((i) =>
        i.name.toLowerCase().includes("assignment 1")
      );
      expect(a1?.is_datetime).toBe(false);
    }, 60_000);
  }
);
