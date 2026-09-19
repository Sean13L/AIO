import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `calendar-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

describe.skipIf(!hasDb)("Calendar feed API routes (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("serves an .ics feed with correct all-day vs timed VEVENTs, 404s on a bad token, and supports sync-target CRUD", async () => {
    const course = await prisma.courses.create({
      data: {
        user_id: mockSession.userId,
        course_code: "CS135",
        course_name: "Designing Functional Programs",
        semester: "1A",
      },
    });
    await prisma.items.create({
      data: {
        course_id: course.id,
        name: "Assignment 1",
        type: "assignment",
        due_at: new Date("2026-09-20T00:00:00Z"),
        is_datetime: false,
      },
    });
    await prisma.items.create({
      data: {
        course_id: course.id,
        name: "Midterm",
        type: "midterm",
        due_at: new Date("2026-10-15T14:00:00Z"),
        is_datetime: true,
        weight: "25%",
      },
    });
    const lecture = await prisma.lectures.create({
      data: {
        course_id: course.id,
        scheduled_at: new Date("2026-09-14T10:00:00Z"),
        week_number: 1,
        topics: "Introduction",
      },
    });
    // Opted-in todo (should appear) alongside one that isn't (should not).
    await prisma.todos.create({
      data: {
        user_id: mockSession.userId,
        title: "Submit essay",
        due_at: new Date("2026-10-25T00:00:00Z"),
        is_datetime: false,
        show_on_calendar: true,
      },
    });
    await prisma.todos.create({
      data: {
        user_id: mockSession.userId,
        title: "Buy groceries",
        due_at: new Date("2026-09-21T00:00:00Z"),
        is_datetime: false,
        show_on_calendar: false,
      },
    });

    const { GET: getFeed } = await import("@/app/api/calendar-feed/route");
    const feedRes = await getFeed(new NextRequest("http://localhost/api/calendar-feed"));
    expect(feedRes.status).toBe(200);
    const { url } = await feedRes.json();
    const token = url.match(/\/calendar\/([a-f0-9]{48})\.ics$/)?.[1];
    expect(token).toBeTruthy();

    const { GET: getIcs } = await import("@/app/calendar/[token]/route");
    const icsRes = await getIcs(new NextRequest(url), {
      params: Promise.resolve({ token: `${token}.ics` }),
    });
    expect(icsRes.status).toBe(200);
    expect(icsRes.headers.get("content-type")).toContain("text/calendar");

    const body = await icsRes.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:CS135: Assignment 1");
    expect(body).toContain("DTSTART;VALUE=DATE:20260920");
    expect(body).toContain("SUMMARY:CS135: Midterm");
    expect(body).toContain("DTSTART:20261015T140000Z");
    // Lecture events must link to their own dedicated pre-review page (per
    // CLAUDE.md's Calendar section), not just the course page — regression
    // coverage for a bug where this pointed at the course page only.
    expect(body).toContain("SUMMARY:CS135: Lecture (Week 1)");
    expect(body.replace(/\r\n /g, "")).toContain(
      `URL:http://localhost:3000/courses/${course.id}/lectures/${lecture.id}`
    );
    // Only the todo with show_on_calendar: true is included.
    expect(body).toContain("SUMMARY:Submit essay");
    expect(body).toContain("DTSTART;VALUE=DATE:20261025");
    expect(body).not.toContain("SUMMARY:Buy groceries");

    const badTokenRes = await getIcs(new NextRequest("http://localhost/calendar/bad.ics"), {
      params: Promise.resolve({ token: "not-a-real-token.ics" }),
    });
    expect(badTokenRes.status).toBe(404);

    // Requesting the feed again returns the same token (stable per user).
    const feedRes2 = await getFeed(new NextRequest("http://localhost/api/calendar-feed"));
    expect((await feedRes2.json()).url).toContain(token);

    // Sync targets.
    const { GET: listTargets, POST: createTarget } = await import(
      "@/app/api/calendar-feed/sync-targets/route"
    );
    const { DELETE: deleteTarget } = await import(
      "@/app/api/calendar-feed/sync-targets/[id]/route"
    );

    const createRes = await createTarget(
      new NextRequest("http://localhost/api/calendar-feed/sync-targets", {
        method: "POST",
        body: JSON.stringify({ label: "Mom's calendar" }),
      })
    );
    expect(createRes.status).toBe(201);
    const target = await createRes.json();
    expect(target.target_type).toBe("ics_subscriber");

    const listRes = await listTargets();
    expect(await listRes.json()).toHaveLength(1);

    const deleteRes = await deleteTarget(
      new NextRequest("http://localhost/api/calendar-feed/sync-targets/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: target.id }) }
    );
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await listTargets();
    expect(await afterDeleteRes.json()).toEqual([]);

    await prisma.courses.delete({ where: { id: course.id } });
  });
});
