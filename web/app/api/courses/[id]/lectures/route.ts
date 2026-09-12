import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

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
