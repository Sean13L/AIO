import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.calendar_sync_targets.deleteMany({
    where: { id, calendar_feeds: { user_id: userId } },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Sync target not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
