import { prisma } from "../prisma";
import { downloadFile, filenameFromFileUrl } from "../storage";
import { extractRawText } from "../extraction/parseFile";
import { isCapacityError } from "../gemini";
import { generatePreview } from "./generatePreview";

// The daily cron generates previews for every user's upcoming lectures in
// one run, outside any user's daily cap — so it's the one place Studdy can
// fire a burst of back-to-back Gemini requests at the project's shared
// free-tier quota. These knobs keep that burst bounded:
// - soonest lectures first, capped per run (PREVIEW_CRON_MAX_PER_RUN)
// - calls started at least PREVIEW_CRON_SPACING_MS apart, to stay under
//   the per-minute limit
// - a time budget that stops before the function's maxDuration
// - stop the whole run on a capacity error: generateContentWithFallback()
//   only throws one after every fallback model refused, so continuing would
//   just burn 6 more requests per lecture against an exhausted quota
// - skip lectures with no topics and no slides, whose preview would be
//   generic filler
// Anything deferred stays not_generated and is retried by the next run while
// still inside the lead window, or can be generated on demand from its page.
export interface PreviewCronOptions {
  now?: Date;
  leadHours?: number;
  maxPerRun?: number;
  minSpacingMs?: number;
  timeBudgetMs?: number;
  // Tests only: restricts the run to one user's lectures, since dev and
  // production share a database.
  userId?: string;
  generate?: typeof generatePreview;
  sleep?: (ms: number) => Promise<void>;
}

export interface PreviewCronResult {
  eligible: number;
  generated: number;
  failed: number;
  deferred: number;
  skipped_no_content: number;
  stopped_on_capacity_error: boolean;
}

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runPreviewCron({
  now = new Date(),
  leadHours = envNumber("PREVIEW_LEAD_HOURS", 48),
  maxPerRun = envNumber("PREVIEW_CRON_MAX_PER_RUN", 20),
  minSpacingMs = envNumber("PREVIEW_CRON_SPACING_MS", 5000),
  timeBudgetMs = 50_000,
  userId,
  generate = generatePreview,
  sleep = defaultSleep,
}: PreviewCronOptions = {}): Promise<PreviewCronResult> {
  const startedAt = Date.now();
  const cutoff = new Date(now.getTime() + leadHours * 60 * 60 * 1000);
  const inWindow = {
    preview_status: "not_generated" as const,
    scheduled_at: { gte: now, lte: cutoff },
    ...(userId ? { courses: { user_id: userId } } : {}),
  };
  const hasContent = {
    OR: [{ AND: [{ topics: { not: null } }, { NOT: { topics: "" } }] }, { slides_url: { not: null } }],
  };

  const [eligible, skippedNoContent] = await Promise.all([
    prisma.lectures.count({ where: { ...inWindow, ...hasContent } }),
    prisma.lectures.count({ where: { ...inWindow, NOT: hasContent } }),
  ]);
  const lectures = await prisma.lectures.findMany({
    where: { ...inWindow, ...hasContent },
    include: { courses: { select: { course_code: true, user_id: true } } },
    orderBy: { scheduled_at: "asc" },
    take: maxPerRun,
  });

  let generated = 0;
  let failed = 0;
  let attempted = 0;
  let stoppedOnCapacityError = false;
  let lastCallStartedAt: number | null = null;

  for (const lecture of lectures) {
    if (lastCallStartedAt !== null) {
      const wait = lastCallStartedAt + minSpacingMs - Date.now();
      if (Date.now() - startedAt + Math.max(wait, 0) >= timeBudgetMs) break;
      if (wait > 0) await sleep(wait);
    }
    lastCallStartedAt = Date.now();
    attempted += 1;

    try {
      const filename = filenameFromFileUrl(lecture.slides_url);
      const slidesBuffer = filename ? await downloadFile("lectures", filename) : null;
      const slidesText = slidesBuffer
        ? await extractRawText({ kind: "file", buffer: slidesBuffer, fileName: filename! })
        : null;

      const previewContent = await generate({
        courseCode: lecture.courses.course_code,
        topics: lecture.topics,
        slidesText,
        feature: "lecture_preview_cron",
        userId: lecture.courses.user_id,
      });

      await prisma.lectures.update({
        where: { id: lecture.id },
        data: { preview_content: previewContent, preview_status: "generated" },
      });
      generated += 1;
    } catch (err) {
      failed += 1;
      console.error(`[generate-previews cron] lecture ${lecture.id} failed:`, err);
      if (isCapacityError(err)) {
        stoppedOnCapacityError = true;
        break;
      }
    }
  }

  return {
    eligible,
    generated,
    failed,
    deferred: eligible - attempted,
    skipped_no_content: skippedNoContent,
    stopped_on_capacity_error: stoppedOnCapacityError,
  };
}
