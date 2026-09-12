import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const lecture = await prisma.lectures.findFirst({
    where: { id, courses: { user_id: userId } },
  });
  if (!lecture) return NextResponse.json({ error: "Lecture not found" }, { status: 404 });

  // Viewing the page is what flips "generated" -> "viewed".
  if (lecture.preview_status === "generated") {
    await prisma.lectures.update({ where: { id }, data: { preview_status: "viewed" } });
    lecture.preview_status = "viewed";
  }

  return NextResponse.json(lecture);
}
