import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { extracurricularUpdateSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const parsed = extracurricularUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.extracurriculars.updateMany({
    where: { id, user_id: userId },
    data: parsed.data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Extracurricular not found" }, { status: 404 });
  }

  const item = await prisma.extracurriculars.findUnique({ where: { id } });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.extracurriculars.deleteMany({ where: { id, user_id: userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Extracurricular not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
