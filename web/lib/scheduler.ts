import { prisma } from "./prisma";
import { readSlidesText } from "./preview/readSlidesText";
import { generatePreview } from "./preview/generatePreview";

// Trigger mechanism for pre-lecture previews (CLAUDE.md: "a scheduled job
// that checks what's the next lecture for each course and generates/
// refreshes the preview a set amount of time beforehand"). A simple
// in-process poller rather than a separate cron/queue system — reasonable
// for a single-instance deployment (`next start` is a persistent Node
// process, not serverless); would need to move to a real job queue if this
// ever runs on more than one instance or a serverless platform.
const LEAD_HOURS = Number(process.env.PREVIEW_LEAD_HOURS ?? 48);
const POLL_INTERVAL_MINUTES = Number(process.env.PREVIEW_POLL_INTERVAL_MINUTES ?? 15);

interface LectureNeedingPreview {
  id: string;
  slides_url: string | null;
  topics: string | null;
  courses: { course_code: string };
}

async function generateForLecture(lecture: LectureNeedingPreview): Promise<void> {
  const slidesText = await readSlidesText(lecture.slides_url);
  const previewContent = await generatePreview({
    courseCode: lecture.courses.course_code,
    topics: lecture.topics,
    slidesText,
  });
  await prisma.lectures.update({
    where: { id: lecture.id },
    data: { preview_content: previewContent, preview_status: "generated" },
  });
}

async function sweep(): Promise<void> {
  let lectures: LectureNeedingPreview[];
  try {
    lectures = await prisma.lectures.findMany({
      where: {
        preview_status: "not_generated",
        scheduled_at: {
          gte: new Date(),
          lte: new Date(Date.now() + LEAD_HOURS * 60 * 60 * 1000),
        },
      },
      include: { courses: { select: { course_code: true } } },
    });
  } catch (err) {
    console.error("[scheduler] failed to query lectures needing a preview:", err);
    return;
  }

  for (const lecture of lectures) {
    try {
      await generateForLecture(lecture);
      console.log(
        `[scheduler] generated preview for lecture ${lecture.id} (${lecture.courses.course_code})`
      );
    } catch (err) {
      console.error(`[scheduler] failed to generate preview for lecture ${lecture.id}:`, err);
    }
  }
}

let started = false;

export function startPreviewScheduler(): void {
  if (started) return; // guards against next dev re-invoking register()
  started = true;

  console.log(
    `[scheduler] pre-lecture preview generator: checking every ${POLL_INTERVAL_MINUTES}min ` +
      `for lectures within ${LEAD_HOURS}h`
  );
  void sweep();
  setInterval(sweep, POLL_INTERVAL_MINUTES * 60_000);
}
