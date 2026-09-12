import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { itemCreateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: courseId } = await params;

  const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const items = await prisma.items.findMany({
    where: { course_id: courseId },
    orderBy: { due_at: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: courseId } = await params;

  const course = await prisma.courses.findFirst({ where: { id: courseId, user_id: userId } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const parsed = itemCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.items.create({
    data: {
      course_id: courseId,
      name: parsed.data.name,
      type: parsed.data.type,
      due_at: toTimestamp(parsed.data.due_date, parsed.data.due_time),
      is_datetime: parsed.data.due_time !== null,
      weight: parsed.data.weight ?? null,
      notes: parsed.data.notes ?? null,
      source: "manual",
    },
  });
  return NextResponse.json(item, { status: 201 });
}
