import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadFile, filenameFromFileUrl } from "@/lib/storage";
import { extractRawText } from "@/lib/extraction/parseFile";
import { generatePreview } from "@/lib/preview/generatePreview";

// Triggered by Vercel Cron (see vercel.json) in place of the always-on
// polling loop the old worker/src/scheduler.ts ran. Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically for scheduled
// invocations when CRON_SECRET is set — verify it so this can't be
// triggered by anyone who finds the URL. Locally/in CI, where CRON_SECRET
// is typically unset, the check is skipped so this stays testable without
// needing the header — but that skip is scoped to non-production so an
// unset CRON_SECRET can never leave this open on a real deployment.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[generate-previews cron] CRON_SECRET is not set in production — refusing to run unauthenticated.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const leadHours = Number(process.env.PREVIEW_LEAD_HOURS ?? 48);
  const now = new Date();
  const cutoff = new Date(now.getTime() + leadHours * 60 * 60 * 1000);

  const dueLectures = await prisma.lectures.findMany({
    where: {
      preview_status: "not_generated",
      scheduled_at: { gte: now, lte: cutoff },
    },
    include: { courses: { select: { course_code: true } } },
  });

  let generated = 0;
  let failed = 0;

  for (const lecture of dueLectures) {
    try {
      const filename = filenameFromFileUrl(lecture.slides_url);
      const slidesBuffer = filename ? await downloadFile("lectures", filename) : null;
      const slidesText = slidesBuffer
        ? await extractRawText({ kind: "file", buffer: slidesBuffer, fileName: filename! })
        : null;

      const previewContent = await generatePreview({
        courseCode: lecture.courses.course_code,
        topics: lecture.topics,
        slidesText,
      });

      await prisma.lectures.update({
        where: { id: lecture.id },
        data: { preview_content: previewContent, preview_status: "generated" },
      });
      generated += 1;
    } catch (err) {
      failed += 1;
      console.error(`[generate-previews cron] lecture ${lecture.id} failed:`, err);
    }
  }

  return NextResponse.json({ checked: dueLectures.length, generated, failed });
}
