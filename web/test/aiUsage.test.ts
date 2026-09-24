import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { readableGeminiErrorMessage } from "@/lib/aiUsage";

const hasDb = Boolean(process.env.DATABASE_URL);
const DAY = 24 * 60 * 60 * 1000;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readableGeminiErrorMessage", () => {
  it("pulls the message out of Gemini's JSON error body", () => {
    expect(
      readableGeminiErrorMessage(
        '{"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}'
      )
    ).toBe("The model is overloaded. Please try again later.");
  });

  it("keeps non-JSON text as-is", () => {
    expect(readableGeminiErrorMessage("fetch failed: socket hang up")).toBe("fetch failed: socket hang up");
  });

  it("strips Google Cloud project identifiers and API keys", () => {
    const message = readableGeminiErrorMessage(
      JSON.stringify({
        error: {
          code: 429,
          message:
            "Quota exceeded for quota metric on consumer projects/123456789012, project_number: 123456789012, key AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW",
        },
      })
    );
    expect(message).not.toMatch(/123456789012/);
    expect(message).not.toMatch(/AIza/);
    expect(message).toContain("Quota exceeded");
  });
});

describe.skipIf(!hasDb)("GET /api/ai-usage (requires DATABASE_URL)", () => {
  let otherUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `ai-usage-test-${Date.now()}@example.com` } });
    mockSession.userId = user.id;
    const other = await prisma.user.create({
      data: { email: `ai-usage-test-other-${Date.now()}@example.com` },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    // Cascades to gemini_usage and gemini_errors.
    await prisma.user.deleteMany({ where: { id: { in: [mockSession.userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  function utcDay(offsetDays: number): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offsetDays * DAY);
  }

  it("returns 401 when signed out", async () => {
    const saved = mockSession.userId;
    mockSession.userId = "";
    const { GET } = await import("@/app/api/ai-usage/route");
    const res = await GET();
    expect(res.status).toBe(401);
    mockSession.userId = saved;
  });

  it("reports today's usage, 14 days of history, and only this user's recent errors", async () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "50");
    const userId = mockSession.userId;
    await prisma.gemini_usage.createMany({
      data: [
        { user_id: userId, date: utcDay(0), count: 53 },
        { user_id: userId, date: utcDay(-1), count: 7 },
        { user_id: userId, date: utcDay(-20), count: 5 },
      ],
    });
    await prisma.gemini_errors.createMany({
      data: [
        { user_id: userId, feature: "quiz", model: "gemini-3.6-flash", status: 429, message: '{"error":{"code":429,"message":"Quota exceeded"}}' },
        { user_id: userId, feature: "quiz", model: "gemini-3.6-flash", status: 503, message: "old", created_at: new Date(Date.now() - 40 * DAY) },
        { user_id: otherUserId, feature: "study_guide", model: "gemini-3.6-flash", status: 503, message: "someone else's" },
      ],
    });

    const { GET } = await import("@/app/api/ai-usage/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.limit).toBe(50);
    expect(body.today).toEqual({ used: 50, blocked: 3 });
    expect(body.resets_at).toBe(utcDay(1).toISOString());

    expect(body.history).toHaveLength(14);
    expect(body.history.at(-1)).toEqual({ date: utcDay(0).toISOString().slice(0, 10), count: 50 });
    expect(body.history.at(-2)).toEqual({ date: utcDay(-1).toISOString().slice(0, 10), count: 7 });
    expect(body.history.at(0).date).toBe(utcDay(-13).toISOString().slice(0, 10));
    expect(body.history.reduce((sum: number, d: { count: number }) => sum + d.count, 0)).toBe(57);

    expect(body.error_total).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0]).toMatchObject({ feature: "quiz", status: 429, message: "Quota exceeded" });
  });
});
