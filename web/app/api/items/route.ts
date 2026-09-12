import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

// All items across every course for the current user, with course info
// attached — backs the timeline/board views and mirrors the old GET
// /api/items shape from server/'s Express API.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const items = await prisma.items.findMany({
    where: { courses: { user_id: userId } },
    include: { courses: { select: { course_code: true, course_name: true } } },
    orderBy: { due_at: "asc" },
  });

  const flattened = items.map(({ courses, ...item }) => ({
    ...item,
    course_code: courses.course_code,
    course_name: courses.course_name,
  }));

  return NextResponse.json(flattened);
}
