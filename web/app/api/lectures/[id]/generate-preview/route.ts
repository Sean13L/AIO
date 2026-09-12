import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { downloadFile, filenameFromFileUrl } from "@/lib/storage";
import { extractRawText } from "@/lib/extraction/parseFile";
import { generatePreview } from "@/lib/preview/generatePreview";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({
    where: { id, courses: { user_id: userId } },
    include: { courses: { select: { course_code: true } } },
  });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

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

  const updated = await prisma.lectures.update({
    where: { id },
    data: { preview_content: previewContent, preview_status: "generated" },
  });
  return NextResponse.json(updated);
}
