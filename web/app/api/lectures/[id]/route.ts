import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({
    where: { id, courses: { user_id: userId } },
  });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  // Viewing the page is what flips "generated" -> "viewed".
  if (lecture.preview_status === "generated") {
    await prisma.lectures.update({ where: { id }, data: { preview_status: "viewed" } });
    lecture.preview_status = "viewed";
  }

  return NextResponse.json(lecture);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({ where: { id, courses: { user_id: userId } } });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!("transcript" in body)) {
    return NextResponse.json({ error: "Provide a 'transcript' field" }, { status: 400 });
  }
  const transcript = body.transcript;
  if (transcript !== null && typeof transcript !== "string") {
    return NextResponse.json({ error: "'transcript' must be a string or null" }, { status: 400 });
  }

  // Saving a transcript from scratch, or editing it down, invalidates
  // whatever summary was generated from the old text — otherwise the two
  // could silently drift apart (a summary describing content the transcript
  // no longer contains, or missing content that's now there).
  const updated = await prisma.lectures.update({
    where: { id },
    data: { transcript, transcript_summary: null },
  });
  return NextResponse.json(updated);
}
