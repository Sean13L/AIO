import { prisma } from "./prisma";

const DEFAULT_DAILY_LIMIT = 50;

export function geminiDailyLimit(): number {
  const raw = process.env.GEMINI_DAILY_LIMIT;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT;
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface GeminiUsageResult {
  allowed: boolean;
  count: number;
  limit: number;
  // The UTC day this call was counted against — passed back to
  // refundGeminiCall() so a request that straddles midnight refunds the
  // day it was actually charged to.
  date: Date;
}

// Atomically records one Gemini-backed call attempt for this user today and
// reports whether it's within the daily cap. Call this immediately before
// actually invoking Gemini (extraction, preview generation, transcript
// summary, study guide generation) — a single shared budget across all
// four, not one cap per endpoint, since what's being protected is total
// Gemini spend/call volume for the account, not any one feature. The
// upsert's increment is a single atomic UPDATE, so concurrent requests
// can't race past the limit.
export async function recordGeminiCallAndCheckLimit(userId: string): Promise<GeminiUsageResult> {
  const limit = geminiDailyLimit();
  const date = todayUTC();

  const usage = await prisma.gemini_usage.upsert({
    where: { user_id_date: { user_id: userId, date } },
    create: { user_id: userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });

  return { allowed: usage.count <= limit, count: usage.count, limit, date };
}

// Gives back the call recorded by recordGeminiCallAndCheckLimit() when the
// work it was charged for fails (Gemini error after exhausting fallbacks,
// unparseable upload, DB write failure) — users shouldn't lose a use of
// their daily budget on something that produced nothing. Best-effort: never
// throws, so the caller's original error is what surfaces.
export async function refundGeminiCall(userId: string, date: Date): Promise<void> {
  try {
    await prisma.gemini_usage.updateMany({
      where: { user_id: userId, date, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  } catch (err) {
    console.error("[geminiUsage] failed to refund Gemini call", err);
  }
}

// Shared across every route that enforces the cap, so the endpoint list in
// the message can't drift out of sync between them.
export function geminiUsageLimitMessage(limit: number): string {
  return `Daily AI usage limit reached (${limit}/day across syllabus uploads, lecture previews, lecture summaries, and study guides). Try again after midnight UTC.`;
}
