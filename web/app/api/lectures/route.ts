import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

// All lectures across every course for the current user, with course info
// attached — backs the internal calendar view alongside GET /api/items.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const lectures = await prisma.lectures.findMany({
    where: { courses: { user_id: userId } },
    include: { courses: { select: { course_code: true, course_name: true } } },
    orderBy: { scheduled_at: "asc" },
  });

  const flattened = lectures.map(({ courses, ...lecture }) => ({
    ...lecture,
    course_code: courses.course_code,
    course_name: courses.course_name,
  }));

  return NextResponse.json(flattened);
}
