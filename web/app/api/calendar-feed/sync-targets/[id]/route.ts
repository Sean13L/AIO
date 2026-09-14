import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { deleteAllEventsForTarget } from "@/lib/calendar/googleCalendar";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const target = await prisma.calendar_sync_targets.findFirst({
    where: { id, calendar_feeds: { user_id: userId } },
  });
  if (!target) return NextResponse.json({ error: "Sync target not found" }, { status: 404 });

  // Best-effort: don't leave stale events behind in the user's Google
  // Calendar after they disconnect it. Runs before the DB delete, same
  // "storage hiccup shouldn't block the delete" precedent as the file
  // cleanup in app/api/courses/[id]/route.ts.
  if (target.target_type === "google_oauth") {
    const [items, lectures] = await Promise.all([
      prisma.items.findMany({ where: { courses: { user_id: userId } }, select: { id: true } }),
      prisma.lectures.findMany({ where: { courses: { user_id: userId } }, select: { id: true } }),
    ]);
    await deleteAllEventsForTarget(
      target,
      [...items, ...lectures].map((record) => record.id)
    );
  }

  await prisma.calendar_sync_targets.delete({ where: { id: target.id } });
  return new NextResponse(null, { status: 204 });
}
