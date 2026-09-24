import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runPreviewCron } from "@/lib/preview/runPreviewCron";
import { pruneGeminiErrors, recordGeminiError } from "@/lib/geminiErrors";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `preview-cron-test-${Date.now()}@example.com`;
const HOUR = 60 * 60 * 1000;

// Offline mock preview generator only — no real Gemini calls from tests.
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const capacityError = () =>
  new Error('{"error":{"code":429,"message":"Quota exceeded","status":"RESOURCE_EXHAUSTED"}}');

// Every run is scoped to this suite's user (`userId`), since dev and
// production share a database — an unscoped run would touch real lectures.
describe.skipIf(!hasDb)("runPreviewCron (requires DATABASE_URL)", () => {
  let userId: string;
  let courseId: string;
  const now = new Date();

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    userId = user.id;
    const course = await prisma.courses.create({
      data: { user_id: userId, course_code: "ECON101", course_name: "Microeconomics", semester: "1A" },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.lectures.deleteMany({ where: { course_id: courseId } });
  });

  function lecture(hoursFromNow: number, data: { topics?: string | null; slides_url?: string | null } = {}) {
    return prisma.lectures.create({
      data: {
        course_id: courseId,
        scheduled_at: new Date(now.getTime() + hoursFromNow * HOUR),
        topics: "topics" in data ? data.topics : "Supply and demand",
        slides_url: data.slides_url ?? null,
      },
    });
  }

  it("generates in-window lectures, skipping ones with no topics or slides and ones outside the window", async () => {
    const due = await lecture(10);
    const empty = await lecture(12, { topics: null });
    const blank = await lecture(14, { topics: "" });
    const later = await lecture(72);

    const result = await runPreviewCron({ now, userId, minSpacingMs: 0 });

    expect(result).toEqual({
      eligible: 1,
      generated: 1,
      failed: 0,
      deferred: 0,
      skipped_no_content: 2,
      stopped_on_capacity_error: false,
    });
    const rows = await prisma.lectures.findMany({ where: { course_id: courseId } });
    const status = Object.fromEntries(rows.map((r) => [r.id, r.preview_status]));
    expect(status[due.id]).toBe("generated");
    expect(status[empty.id]).toBe("not_generated");
    expect(status[blank.id]).toBe("not_generated");
    expect(status[later.id]).toBe("not_generated");
  });

  it("caps each run and does the soonest lectures first", async () => {
    const third = await lecture(30);
    const first = await lecture(5);
    const second = await lecture(20);

    const result = await runPreviewCron({ now, userId, minSpacingMs: 0, maxPerRun: 2 });

    expect(result).toMatchObject({ eligible: 3, generated: 2, deferred: 1 });
    const generatedIds = (
      await prisma.lectures.findMany({ where: { course_id: courseId, preview_status: "generated" } })
    ).map((r) => r.id);
    expect(generatedIds.sort()).toEqual([first.id, second.id].sort());
    expect(generatedIds).not.toContain(third.id);
  });

  it("spaces calls at least minSpacingMs apart", async () => {
    await lecture(5);
    await lecture(6);
    const sleep = vi.fn(async () => {});

    await runPreviewCron({ now, userId, minSpacingMs: 5000, sleep });

    expect(sleep).toHaveBeenCalledTimes(1);
    const [[waited]] = sleep.mock.calls as unknown as [[number]];
    expect(waited).toBeGreaterThan(4000);
    expect(waited).toBeLessThanOrEqual(5000);
  });

  it("stops the whole run on a capacity error instead of hammering an exhausted quota", async () => {
    await lecture(5);
    await lecture(6);
    await lecture(7);
    const generate = vi.fn(async () => {
      throw capacityError();
    });

    const result = await runPreviewCron({ now, userId, minSpacingMs: 0, generate });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      eligible: 3,
      generated: 0,
      failed: 1,
      deferred: 2,
      stopped_on_capacity_error: true,
    });
  });

  it("keeps going past a non-capacity failure on one lecture", async () => {
    await lecture(5);
    await lecture(6);
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Gemini did not return text for the lecture preview"))
      .mockResolvedValueOnce("preview text");

    const result = await runPreviewCron({ now, userId, minSpacingMs: 0, generate });

    expect(result).toMatchObject({ generated: 1, failed: 1, stopped_on_capacity_error: false });
  });

  it("stops before exceeding its time budget", async () => {
    await lecture(5);
    await lecture(6);
    const sleep = vi.fn(async () => {});

    // A 5s spacing wait can't fit in a 1s budget, so only the first runs.
    const result = await runPreviewCron({ now, userId, minSpacingMs: 5000, timeBudgetMs: 1000, sleep });

    expect(result).toMatchObject({ generated: 1, deferred: 1 });
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe.skipIf(!hasDb)("gemini_errors record (requires DATABASE_URL)", () => {
  it("records a failed attempt with its status, and prunes rows older than 30 days", async () => {
    const tag = `test-${Date.now()}`;
    await recordGeminiError("quiz", tag, capacityError());
    const recent = await prisma.gemini_errors.findFirstOrThrow({ where: { model: tag } });
    expect(recent).toMatchObject({ feature: "quiz", status: 429 });

    const old = await prisma.gemini_errors.create({
      data: {
        feature: "quiz",
        model: tag,
        status: 503,
        message: "old",
        created_at: new Date(Date.now() - 31 * 24 * HOUR),
      },
    });

    await pruneGeminiErrors();

    expect(await prisma.gemini_errors.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.gemini_errors.findUnique({ where: { id: recent.id } })).not.toBeNull();
    await prisma.gemini_errors.deleteMany({ where: { model: tag } });
  });
});
