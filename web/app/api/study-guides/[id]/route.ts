import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { STUDY_GUIDE_DETAIL_INCLUDE, serializeStudyGuide } from "@/lib/studyGuide/serialize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const guide = await prisma.study_guides.findFirst({
    where: { id, user_id: userId },
    include: STUDY_GUIDE_DETAIL_INCLUDE,
  });
  if (!guide) return NextResponse.json({ error: "Study guide not found" }, { status: 404 });

  return NextResponse.json(serializeStudyGuide(guide));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.study_guides.deleteMany({ where: { id, user_id: userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Study guide not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
