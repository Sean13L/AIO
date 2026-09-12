import fs from "node:fs";
import { prisma } from "./prisma.js";
import { filePath, isSafeFilename } from "./storage.js";
import { extractRawText } from "./extraction/parseFile.js";
import { generatePreview } from "./preview/generatePreview.js";

// Trigger mechanism for pre-lecture previews (CLAUDE.md: "a scheduled job
// that checks what's the next lecture for each course and generates/
// refreshes the preview a set amount of time beforehand"). Lives in this
// always-on worker rather than the (serverless) web app, since serverless
// functions don't stay warm for a setInterval loop.
const LEAD_HOURS = Number(process.env.PREVIEW_LEAD_HOURS ?? 48);
const POLL_INTERVAL_MINUTES = Number(process.env.PREVIEW_POLL_INTERVAL_MINUTES ?? 15);

interface LectureNeedingPreview {
  id: string;
  slides_url: string | null;
  topics: string | null;
  courses: { course_code: string };
}

async function readSlidesText(slidesUrl: string | null): Promise<string | null> {
  if (!slidesUrl) return null;
  const filename = slidesUrl.split("/").pop();
  if (!filename || !isSafeFilename(filename)) return null;

  const target = filePath("lectures", filename);
  if (!fs.existsSync(target)) return null;

  return extractRawText({ kind: "file", buffer: fs.readFileSync(target), fileName: filename });
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

export function startPreviewScheduler(): void {
  console.log(
    `[scheduler] pre-lecture preview generator: checking every ${POLL_INTERVAL_MINUTES}min ` +
      `for lectures within ${LEAD_HOURS}h`
  );
  void sweep();
  setInterval(sweep, POLL_INTERVAL_MINUTES * 60_000);
}
