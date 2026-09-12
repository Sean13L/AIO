import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { extracurricularInputSchema } from "@/lib/validation";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const items = await prisma.extracurriculars.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = extracurricularInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.extracurriculars.create({
    data: {
      user_id: userId,
      title: parsed.data.title,
      content: parsed.data.content ?? null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
