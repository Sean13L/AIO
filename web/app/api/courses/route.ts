import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { courseInputSchema } from "@/lib/validation";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const courses = await prisma.courses.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = courseInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const course = await prisma.courses.create({
    data: {
      user_id: userId,
      course_code: parsed.data.course_code,
      course_name: parsed.data.course_name,
      semester: parsed.data.semester ?? null,
    },
  });
  return NextResponse.json(course, { status: 201 });
}
