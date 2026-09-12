import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { itemUpdateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const parsed = itemUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { due_date, due_time, ...rest } = parsed.data;
  const data: Prisma.itemsUpdateManyMutationInput = { ...rest };
  if (due_date !== undefined) {
    data.due_at = toTimestamp(due_date, due_time ?? null);
    data.is_datetime = due_time !== null;
  }

  const result = await prisma.items.updateMany({
    where: { id, courses: { user_id: userId } },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = await prisma.items.findUnique({ where: { id } });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.items.deleteMany({
    where: { id, courses: { user_id: userId } },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
