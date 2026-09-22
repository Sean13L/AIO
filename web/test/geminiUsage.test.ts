import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { geminiDailyLimit, recordGeminiCallAndCheckLimit } from "@/lib/geminiUsage";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `gemini-usage-test-${Date.now()}@example.com`;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("geminiDailyLimit", () => {
  it("defaults to 50 when GEMINI_DAILY_LIMIT is unset or invalid", () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "");
    expect(geminiDailyLimit()).toBe(50);
    vi.stubEnv("GEMINI_DAILY_LIMIT", "not-a-number");
    expect(geminiDailyLimit()).toBe(50);
    vi.stubEnv("GEMINI_DAILY_LIMIT", "0");
    expect(geminiDailyLimit()).toBe(50);
    vi.stubEnv("GEMINI_DAILY_LIMIT", "-5");
    expect(geminiDailyLimit()).toBe(50);
  });

  it("honors a valid override", () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "3");
    expect(geminiDailyLimit()).toBe(3);
  });
});

describe.skipIf(!hasDb)("recordGeminiCallAndCheckLimit (requires DATABASE_URL)", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.gemini_usage.deleteMany({ where: { user_id: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.gemini_usage.deleteMany({ where: { user_id: userId } });
  });

  it("allows calls up to the limit, then blocks — scoped to this user only", async () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "2");

    const first = await recordGeminiCallAndCheckLimit(userId);
    expect(first).toEqual({ allowed: true, count: 1, limit: 2 });

    const second = await recordGeminiCallAndCheckLimit(userId);
    expect(second).toEqual({ allowed: true, count: 2, limit: 2 });

    const third = await recordGeminiCallAndCheckLimit(userId);
    expect(third.allowed).toBe(false);
    expect(third.count).toBe(3);

    const otherUser = await prisma.user.create({
      data: { email: `gemini-usage-test-other-${Date.now()}@example.com` },
    });
    const otherResult = await recordGeminiCallAndCheckLimit(otherUser.id);
    expect(otherResult).toEqual({ allowed: true, count: 1, limit: 2 });

    await prisma.gemini_usage.deleteMany({ where: { user_id: otherUser.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("resets on a new UTC calendar day", async () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "1");

    const today = await recordGeminiCallAndCheckLimit(userId);
    expect(today).toEqual({ allowed: true, count: 1, limit: 1 });

    // Simulate "yesterday" by backdating the row directly, rather than
    // mocking the system clock — recordGeminiCallAndCheckLimit() derives
    // "today" from `new Date()` internally.
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDate = new Date(
      Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate())
    );
    await prisma.gemini_usage.updateMany({
      where: { user_id: userId },
      data: { date: yesterdayDate },
    });

    const fresh = await recordGeminiCallAndCheckLimit(userId);
    expect(fresh).toEqual({ allowed: true, count: 1, limit: 1 });
  });
});
