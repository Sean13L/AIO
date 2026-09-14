import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  buildAuthorizeUrl,
  deleteRecordEventFromGoogle,
  googleCalendarConfigured,
  syncUserCalendarToGoogle,
} from "@/lib/calendar/googleCalendar";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `google-calendar-test-${Date.now()}@example.com`;

describe("buildAuthorizeUrl / googleCalendarConfigured", () => {
  const originalId = process.env.GOOGLE_CLIENT_ID;
  const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalId;
    process.env.GOOGLE_CLIENT_SECRET = originalSecret;
  });

  it("reports configured only when both client id and secret are set", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(googleCalendarConfigured()).toBe(true);

    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(googleCalendarConfigured()).toBe(false);
  });

  it("requests the calendar.events scope with offline access and forced consent", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    const url = new URL(buildAuthorizeUrl("test-state"));
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.events");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("test-state");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
  });
});

describe.skipIf(!hasDb)("Google Calendar push (requires DATABASE_URL)", () => {
  let userId: string;
  let courseId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    userId = user.id;
    const course = await prisma.courses.create({
      data: { user_id: userId, course_code: "CS135", course_name: "Test Course" },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.calendar_sync_targets.deleteMany({ where: { calendar_feeds: { user_id: userId } } });
    await prisma.calendar_feeds.deleteMany({ where: { user_id: userId } });
    vi.unstubAllGlobals();
  });

  async function createGoogleTarget(overrides: Partial<{
    google_token_expires_at: Date;
    google_refresh_token: string | null;
  }> = {}) {
    const feed = await prisma.calendar_feeds.create({
      data: { user_id: userId, feed_token: `token-${Date.now()}-${Math.random()}` },
    });
    return prisma.calendar_sync_targets.create({
      data: {
        feed_id: feed.id,
        target_type: "google_oauth",
        label: "test@gmail.com",
        google_access_token: "initial-access-token",
        google_refresh_token: overrides.google_refresh_token ?? null,
        google_token_expires_at: overrides.google_token_expires_at ?? new Date(Date.now() + 3600_000),
      },
    });
  }

  it("upserts an all-day item event and a timed lecture event, inserting when the update 404s", async () => {
    const item = await prisma.items.create({
      data: {
        course_id: courseId,
        name: "Assignment 1",
        type: "assignment",
        due_at: new Date("2026-09-20T00:00:00Z"),
        is_datetime: false,
      },
    });
    const lecture = await prisma.lectures.create({
      data: { course_id: courseId, scheduled_at: new Date("2026-09-14T10:00:00Z"), week_number: 1 },
    });
    await createGoogleTarget();

    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          method: init?.method ?? "GET",
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        });
        if (init?.method === "PUT") return new Response("not found", { status: 404 });
        return new Response(JSON.stringify({ id: "created" }), { status: 200 });
      })
    );

    await syncUserCalendarToGoogle(userId);

    const itemEventId = item.id.replace(/-/g, "");
    const lectureEventId = lecture.id.replace(/-/g, "");

    const itemUpdate = calls.find((c) => c.method === "PUT" && c.url.endsWith(`/${itemEventId}`));
    expect(itemUpdate).toBeTruthy();

    const itemInsert = calls.find(
      (c) => c.method === "POST" && (c.body as { id: string }).id === itemEventId
    );
    expect(itemInsert).toBeTruthy();
    expect((itemInsert!.body as { start: { date: string } }).start.date).toBe("2026-09-20");
    expect((itemInsert!.body as { summary: string }).summary).toBe("CS135: Assignment 1");

    const lectureInsert = calls.find(
      (c) => c.method === "POST" && (c.body as { id: string }).id === lectureEventId
    );
    expect(lectureInsert).toBeTruthy();
    expect((lectureInsert!.body as { start: { dateTime: string } }).start.dateTime).toBe(
      "2026-09-14T10:00:00.000Z"
    );
    expect((lectureInsert!.body as { summary: string }).summary).toBe("CS135: Lecture (Week 1)");

    await prisma.items.delete({ where: { id: item.id } });
    await prisma.lectures.delete({ where: { id: lecture.id } });
  });

  it("refreshes an expired access token before pushing, and persists the new one", async () => {
    const target = await createGoogleTarget({
      google_token_expires_at: new Date(Date.now() - 1000),
      google_refresh_token: "a-refresh-token",
    });

    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? "GET" });
        if (url.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({ access_token: "refreshed-token", expires_in: 3600 }),
            { status: 200 }
          );
        }
        return new Response("not found", { status: 404 });
      })
    );

    await syncUserCalendarToGoogle(userId);

    expect(calls.some((c) => c.url.includes("oauth2.googleapis.com/token"))).toBe(true);
    const updated = await prisma.calendar_sync_targets.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.google_access_token).toBe("refreshed-token");
  });

  it("deletes an item's event from every connected Google Calendar", async () => {
    await createGoogleTarget();
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? "GET" });
        return new Response(null, { status: 204 });
      })
    );

    const fakeItemId = "11111111-2222-3333-4444-555555555555";
    await deleteRecordEventFromGoogle(userId, fakeItemId);

    expect(calls).toEqual([
      {
        url: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${fakeItemId.replace(/-/g, "")}`,
        method: "DELETE",
      },
    ]);
  });

  it("does nothing when the user has no connected Google Calendar", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await syncUserCalendarToGoogle(userId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
