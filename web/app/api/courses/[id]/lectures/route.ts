import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { lectureCreateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";
import { syncUserCalendarToGoogle } from "@/lib/calendar/googleCalendar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: courseId } = await params;

  const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const lectures = await prisma.lectures.findMany({
    where: { course_id: courseId },
    orderBy: { scheduled_at: "asc" },
  });
  return NextResponse.json(lectures);
}

// Manually-added lecture — for sessions the syllabus schedule didn't list
// (a makeup class, a tutorial) or courses whose syllabus had no schedule.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: courseId } = await params;

  const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const parsed = lectureCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const lecture = await prisma.lectures.create({
    data: {
      course_id: courseId,
      scheduled_at: toTimestamp(parsed.data.scheduled_date, parsed.data.scheduled_time),
      week_number: parsed.data.week_number ?? null,
      topics: parsed.data.topics?.trim() || null,
      notes: parsed.data.notes?.trim() ? parsed.data.notes : null,
      source: "manual",
    },
  });
  await syncUserCalendarToGoogle(userId);
  return NextResponse.json(lecture, { status: 201 });
}
