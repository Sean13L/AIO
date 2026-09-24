import { prisma } from "./prisma";
import { geminiDailyLimit } from "./geminiUsage";
import type { AiUsageSummary } from "./types";

const HISTORY_DAYS = 14;
const ERROR_WINDOW_DAYS = 30;
const MAX_ERRORS_LISTED = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Gemini errors arrive as a JSON body (`{"error":{"code":429,"message":…}}`);
// show just the human-readable message, and strip identifiers of the
// project's Google Cloud setup, which don't belong in front of users.
export function readableGeminiErrorMessage(raw: string): string {
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") message = parsed.error.message;
  } catch {
    // Not JSON (network error, SDK message) — keep the raw text.
  }
  return message
    .replace(/projects\/[\w-]+/gi, "projects/…")
    .replace(/(project[_ ]?(?:number|id)["']?\s*[:=]\s*["']?)[\w-]+/gi, "$1…")
    .replace(/AIza[\w-]{20,}/g, "…")
    .trim();
}

export async function getAiUsageSummary(userId: string, now: Date = new Date()): Promise<AiUsageSummary> {
  const limit = geminiDailyLimit();
  const today = utcDay(now);
  const historyStart = new Date(today.getTime() - (HISTORY_DAYS - 1) * DAY_MS);
  const errorsSince = new Date(now.getTime() - ERROR_WINDOW_DAYS * DAY_MS);

  const [usageRows, errors, errorTotal] = await Promise.all([
    prisma.gemini_usage.findMany({
      where: { user_id: userId, date: { gte: historyStart } },
      select: { date: true, count: true },
    }),
    prisma.gemini_errors.findMany({
      where: { user_id: userId, created_at: { gte: errorsSince } },
      orderBy: { created_at: "desc" },
      take: MAX_ERRORS_LISTED,
    }),
    prisma.gemini_errors.count({ where: { user_id: userId, created_at: { gte: errorsSince } } }),
  ]);

  const countByDay = new Map(usageRows.map((row) => [row.date.toISOString().slice(0, 10), row.count]));
  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = new Date(historyStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    // The stored count also includes requests refused for being over the
    // limit; cap it so the chart shows what was actually used.
    return { date, count: Math.min(countByDay.get(date) ?? 0, limit) };
  });

  const todayCount = countByDay.get(today.toISOString().slice(0, 10)) ?? 0;

  return {
    limit,
    today: { used: Math.min(todayCount, limit), blocked: Math.max(todayCount - limit, 0) },
    resets_at: new Date(today.getTime() + DAY_MS).toISOString(),
    history,
    errors: errors.map((e) => ({
      id: e.id,
      created_at: e.created_at.toISOString(),
      feature: e.feature,
      model: e.model,
      status: e.status,
      message: readableGeminiErrorMessage(e.message),
    })),
    error_total: errorTotal,
  };
}
