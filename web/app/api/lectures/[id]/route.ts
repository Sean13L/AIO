import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { lectureUpdateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";
import { deleteFile, filenameFromFileUrl } from "@/lib/storage";
import { deleteRecordEventFromGoogle, syncUserCalendarToGoogle } from "@/lib/calendar/googleCalendar";

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

  const parsed = lectureUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { transcript, notes, topics, week_number, scheduled_date, scheduled_time } = parsed.data;

  const data: Prisma.lecturesUpdateInput = {};
  if (transcript !== undefined) {
    // Saving a transcript from scratch, or editing it down, invalidates
    // whatever summary was generated from the old text — otherwise the two
    // could silently drift apart (a summary describing content the
    // transcript no longer contains, or missing content that's now there).
    data.transcript = transcript;
    data.transcript_summary = null;
  }
  if (notes !== undefined) data.notes = notes?.trim() ? notes : null;
  if (topics !== undefined) data.topics = topics?.trim() || null;
  if (week_number !== undefined) data.week_number = week_number;
  if (scheduled_date !== undefined && scheduled_time !== undefined) {
    data.scheduled_at = toTimestamp(scheduled_date, scheduled_time);
  }

  const updated = await prisma.lectures.update({ where: { id }, data });

  // Only fields that appear on the calendar event need a resync — notes and
  // transcript edits (the autosave path, every 20s while recording) don't.
  if (topics !== undefined || week_number !== undefined || scheduled_date !== undefined) {
    await syncUserCalendarToGoogle(userId);
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({ where: { id, courses: { user_id: userId } } });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  await prisma.lectures.delete({ where: { id } });

  // Best-effort cleanup outside the DB — neither should block the delete.
  const slidesFilename = filenameFromFileUrl(lecture.slides_url);
  if (slidesFilename) await deleteFile("lectures", slidesFilename);
  await deleteRecordEventFromGoogle(userId, id);

  return new NextResponse(null, { status: 204 });
}
