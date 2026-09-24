import { prisma } from "./prisma";

// Which Studdy feature made the Gemini request — the label stored with each
// failure so gemini_errors can answer "which feature is hitting the limits".
export type GeminiFeature =
  | "syllabus_extraction"
  | "lecture_preview"
  | "lecture_preview_cron"
  | "transcript_summary"
  | "study_guide"
  | "flashcards"
  | "quiz";

const MAX_MESSAGE_LENGTH = 1000;
const RETENTION_DAYS = 30;

// The SDK's ApiError carries a numeric `status`; fall back to the
// `"code": 503`-style field in the JSON body for anything else.
export function geminiErrorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status;
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : null;
}

// Best-effort: a failure to log must never mask the Gemini error itself.
export async function recordGeminiError(
  feature: GeminiFeature,
  model: string,
  err: unknown
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  try {
    await prisma.gemini_errors.create({
      data: {
        feature,
        model,
        status: geminiErrorStatus(err),
        message: message.slice(0, MAX_MESSAGE_LENGTH),
      },
    });
  } catch (logErr) {
    console.error("[geminiErrors] failed to record Gemini error", logErr);
  }
}

export async function pruneGeminiErrors(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.gemini_errors.deleteMany({ where: { created_at: { lt: cutoff } } });
  return count;
}
