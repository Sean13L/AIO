import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `calendar-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("Calendar feed (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("serves an .ics feed with correct all-day vs timed VEVENTs, and 404s on a bad token", async () => {
    const authed = (method: "get" | "post") => (url: string) =>
      request(app)[method](url).set("X-User-Email", testEmail);

    const course = await authed("post")("/api/courses").send({
      course_code: "CS135",
      course_name: "Designing Functional Programs",
      semester: "1A",
    });
    const courseId = course.body.id;

    await authed("post")(`/api/courses/${courseId}/items`).send({
      name: "Assignment 1",
      type: "assignment",
      due_date: "2026-09-20",
      due_time: null,
      weight: null,
      notes: null,
    });
    await authed("post")(`/api/courses/${courseId}/items`).send({
      name: "Midterm",
      type: "midterm",
      due_date: "2026-10-15",
      due_time: "14:00",
      weight: "25%",
      notes: null,
    });

    const feedRes = await authed("get")("/api/calendar-feed");
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.url).toMatch(/\/calendar\/[a-f0-9]{48}\.ics$/);

    const token = feedRes.body.url.match(/\/calendar\/([a-f0-9]{48})\.ics$/)[1];

    const icsRes = await request(app).get(`/calendar/${token}.ics`);
    expect(icsRes.status).toBe(200);
    expect(icsRes.headers["content-type"]).toContain("text/calendar");

    const body: string = icsRes.text;
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("SUMMARY:CS135: Assignment 1");
    expect(body).toContain("DTSTART;VALUE=DATE:20260920");
    expect(body).toContain("SUMMARY:CS135: Midterm");
    expect(body).toContain("DTSTART:20261015T140000Z");
    expect(body).toMatch(/URL:http:\/\/.+\/courses\//); // links back to the course page

    const badToken = await request(app).get("/calendar/not-a-real-token.ics");
    expect(badToken.status).toBe(404);

    // Requesting the feed URL again should return the same token (stable per
    // user) — compare the token, not the full URL, since supertest binds a
    // fresh ephemeral port per request when no server is already listening.
    const feedRes2 = await authed("get")("/api/calendar-feed");
    expect(feedRes2.body.url).toMatch(new RegExp(`/calendar/${token}\\.ics$`));
  });
});
