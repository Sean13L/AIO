import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";
import { createLecture } from "../src/db/repositories/lectures.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `lecture-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("Lecture pre-review pipeline (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("generates a preview from topics alone, then a richer one once slides are uploaded", async () => {
    const authed = (method: "get" | "post") => (url: string) =>
      request(app)[method](url).set("X-User-Email", testEmail);

    const course = await authed("post")("/api/courses").send({
      course_code: "CS135",
      course_name: "Designing Functional Programs",
      semester: "1A",
    });
    const courseId = course.body.id;

    const lecture = await createLecture(pool, courseId, {
      scheduled_at: "2026-09-08T14:00:00Z",
      week_number: 1,
      topics: "Introduction to recursion and base cases.",
    });

    // Viewing before any preview exists: 404 never happens, but preview_status
    // stays not_generated (nothing to flip to "viewed" yet).
    const initial = await authed("get")(`/api/lectures/${lecture.id}`);
    expect(initial.status).toBe(200);
    expect(initial.body.preview_status).toBe("not_generated");

    const generated1 = await authed("post")(`/api/lectures/${lecture.id}/generate-preview`);
    expect(generated1.status).toBe(200);
    expect(generated1.body.preview_status).toBe("generated");
    expect(generated1.body.preview_content).toContain("recursion");
    expect(generated1.body.preview_content).toContain("No slides uploaded yet");

    // Viewing now should flip generated -> viewed.
    const viewed = await authed("get")(`/api/lectures/${lecture.id}`);
    expect(viewed.body.preview_status).toBe("viewed");

    // Upload a plain-text "slides" file and regenerate — the mock generator
    // should now quote the slide content instead of the no-slides message.
    const slidesPath = path.join(process.cwd(), "test", "fixtures", "slides.txt");
    fs.writeFileSync(slidesPath, "Today: recursion base cases, structural induction, accumulators.");

    const uploadRes = await request(app)
      .post(`/api/lectures/${lecture.id}/slides`)
      .set("X-User-Email", testEmail)
      .attach("slides", slidesPath);
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.slides_url).toMatch(/\/uploads\/lectures\//);

    const generated2 = await authed("post")(`/api/lectures/${lecture.id}/generate-preview`);
    expect(generated2.status).toBe(200);
    expect(generated2.body.preview_content).toContain("accumulators");
    expect(generated2.body.preview_content).not.toContain("No slides uploaded yet");

    fs.unlinkSync(slidesPath);
    const uploadedFile = uploadRes.body.slides_url.split("/").pop();
    fs.unlinkSync(path.join(process.cwd(), "uploads", "lectures", uploadedFile));
  });

  it("lists all lectures across courses for the user, with course_code attached", async () => {
    const course1 = await request(app)
      .post("/api/courses")
      .set("X-User-Email", testEmail)
      .send({ course_code: "LIST-A", course_name: "Course A", semester: "1A" });
    const course2 = await request(app)
      .post("/api/courses")
      .set("X-User-Email", testEmail)
      .send({ course_code: "LIST-B", course_name: "Course B", semester: "1A" });

    await createLecture(pool, course1.body.id, {
      scheduled_at: "2026-09-08T14:00:00Z",
      week_number: 1,
      topics: null,
    });
    await createLecture(pool, course2.body.id, {
      scheduled_at: "2026-09-09T14:00:00Z",
      week_number: 1,
      topics: null,
    });

    const res = await request(app).get("/api/lectures").set("X-User-Email", testEmail);
    expect(res.status).toBe(200);
    const codes = res.body.map((l: { course_code: string }) => l.course_code);
    expect(codes).toEqual(expect.arrayContaining(["LIST-A", "LIST-B"]));
  });

  it("404s for a lecture belonging to another user", async () => {
    const otherEmail = `lecture-test-other-${Date.now()}@example.com`;
    const course = await request(app)
      .post("/api/courses")
      .set("X-User-Email", testEmail)
      .send({ course_code: "ISOLATED", course_name: "Isolation", semester: null });

    const lecture = await createLecture(pool, course.body.id, {
      scheduled_at: "2026-09-08T14:00:00Z",
      week_number: 1,
      topics: null,
    });

    const res = await request(app)
      .get(`/api/lectures/${lecture.id}`)
      .set("X-User-Email", otherEmail);
    expect(res.status).toBe(404);

    await pool.query("DELETE FROM users WHERE email = $1", [otherEmail]);
  });
});
