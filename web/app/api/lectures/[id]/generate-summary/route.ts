import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { generateTranscriptSummary } from "@/lib/transcription/generateTranscriptSummary";
import { geminiUsageLimitMessage, recordGeminiCallAndCheckLimit } from "@/lib/geminiUsage";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({
    where: { id, courses: { user_id: userId } },
    include: { courses: { select: { course_code: true } } },
  });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
  if (!lecture.transcript?.trim()) {
    return NextResponse.json(
      { error: "This lecture has no transcript yet — record one first" },
      { status: 400 }
    );
  }

  const usage = await recordGeminiCallAndCheckLimit(userId);
  if (!usage.allowed) {
    return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
  }

  const { summary, usedMock } = await generateTranscriptSummary({
    courseCode: lecture.courses.course_code,
    transcript: lecture.transcript,
  });

  const updated = await prisma.lectures.update({
    where: { id },
    data: { transcript_summary: summary },
  });
  return NextResponse.json({ ...updated, usedMock });
}
