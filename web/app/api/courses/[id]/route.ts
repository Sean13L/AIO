import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { deleteFile, filenameFromFileUrl } from "@/lib/storage";
import { deleteRecordEventFromGoogle } from "@/lib/calendar/googleCalendar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const course = await prisma.courses.findFirst({ where: { id, user_id: userId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  return NextResponse.json(course);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const course = await prisma.courses.findFirst({
    where: { id, user_id: userId },
    include: { lectures: true, syllabi: true, items: { select: { id: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Prisma's cascade delete below only removes the database rows — stored
  // files (lecture slides, archived syllabus uploads) and pushed Google
  // Calendar events have no foreign key tying their lifetime to these rows,
  // so they'd otherwise be left behind as orphaned storage/stale events
  // with nothing pointing at them. Best-effort and run before the DB delete
  // so a hiccup still lets the user delete the course; anything that fails
  // to clean up just stays orphaned, same as before this existed.
  await Promise.all([
    ...course.lectures
      .map((lecture) => filenameFromFileUrl(lecture.slides_url))
      .filter((filename): filename is string => filename !== null)
      .map((filename) => deleteFile("lectures", filename)),
    ...course.syllabi
      .map((syllabus) => filenameFromFileUrl(syllabus.file_url))
      .filter((filename): filename is string => filename !== null)
      .map((filename) => deleteFile("syllabi", filename)),
    ...[...course.items, ...course.lectures].map((record) =>
      deleteRecordEventFromGoogle(userId, record.id)
    ),
  ]);

  await prisma.courses.delete({ where: { id: course.id } });
  return new NextResponse(null, { status: 204 });
}
