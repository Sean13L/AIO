import { pool } from "./db/client.js";
import {
  listLecturesNeedingPreview,
  setLecturePreview,
  type LectureNeedingPreview,
} from "./db/repositories/lectures.js";
import { readSlidesText } from "./preview/readSlidesText.js";
import { generatePreview } from "./preview/generatePreview.js";

// Trigger mechanism for pre-lecture previews (CLAUDE.md: "a scheduled job
// that checks what's the next lecture for each course and generates/
// refreshes the preview a set amount of time beforehand"). A simple
// in-process poller rather than a separate cron/queue system — reasonable
// for a single-instance deployment; would need to move to a real job queue
// if this ever runs on more than one instance.
const LEAD_HOURS = Number(process.env.PREVIEW_LEAD_HOURS ?? 48);
const POLL_INTERVAL_MINUTES = Number(process.env.PREVIEW_POLL_INTERVAL_MINUTES ?? 15);

async function generateForLecture(lecture: LectureNeedingPreview): Promise<void> {
  const slidesText = await readSlidesText(lecture.slides_url);
  const previewContent = await generatePreview({
    courseCode: lecture.course_code,
    topics: lecture.topics,
    slidesText,
  });
  await setLecturePreview(pool, lecture.id, previewContent);
}

async function sweep(): Promise<void> {
  let lectures: LectureNeedingPreview[];
  try {
    lectures = await listLecturesNeedingPreview(pool, LEAD_HOURS);
  } catch (err) {
    console.error("[scheduler] failed to query lectures needing a preview:", err);
    return;
  }

  for (const lecture of lectures) {
    try {
      await generateForLecture(lecture);
      console.log(
        `[scheduler] generated preview for lecture ${lecture.id} (${lecture.course_code})`
      );
    } catch (err) {
      console.error(`[scheduler] failed to generate preview for lecture ${lecture.id}:`, err);
    }
  }
}

export function startPreviewScheduler(): NodeJS.Timeout {
  console.log(
    `[scheduler] pre-lecture preview generator: checking every ${POLL_INTERVAL_MINUTES}min ` +
      `for lectures within ${LEAD_HOURS}h`
  );
  void sweep();
  return setInterval(sweep, POLL_INTERVAL_MINUTES * 60_000);
}
