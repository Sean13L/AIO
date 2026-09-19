import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { todoUpdateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";
import { deleteRecordEventFromGoogle, syncUserCalendarToGoogle } from "@/lib/calendar/googleCalendar";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const parsed = todoUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.todos.findFirst({ where: { id, user_id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  // due_date absent from the body: leave the deadline untouched (a plain
  // "mark done" PATCH shouldn't wipe it). due_date present (string or
  // explicit null): set or clear the deadline. due_time only matters when
  // due_date is a string.
  const { title, done, due_date, due_time, show_on_calendar } = parsed.data;
  const data: Parameters<typeof prisma.todos.updateMany>[0]["data"] = { title, done };
  if (due_date !== undefined) {
    data.due_at = due_date ? toTimestamp(due_date, due_time ?? null) : null;
    data.is_datetime = Boolean(due_date && due_time);
  }

  const resolvedDueAt = due_date !== undefined ? data.due_at : existing.due_at;

  // Explicitly asking to turn the flag on with no deadline (resolved from
  // this request or the existing row) is rejected outright. Clearing the
  // deadline on a todo that already had the flag on is different — not an
  // error, just an implicit "and stop showing it on the calendar too."
  if (show_on_calendar === true && !resolvedDueAt) {
    return NextResponse.json(
      { error: "Set a deadline before showing this on your calendar" },
      { status: 400 }
    );
  }
  const resolvedShowOnCalendar = resolvedDueAt ? (show_on_calendar ?? existing.show_on_calendar) : false;
  data.show_on_calendar = resolvedShowOnCalendar;

  await prisma.todos.updateMany({ where: { id, user_id: userId }, data });
  const todo = await prisma.todos.findUnique({ where: { id } });

  // A full re-sync only ever adds/updates — if this todo just turned
  // show_on_calendar off (or its deadline was cleared out from under it),
  // the sync loop below would simply stop mentioning it, leaving a stale
  // event on Google forever unless it's explicitly deleted here.
  if (existing.show_on_calendar && !resolvedShowOnCalendar) {
    await deleteRecordEventFromGoogle(userId, id);
  } else if (resolvedShowOnCalendar) {
    await syncUserCalendarToGoogle(userId);
  }

  return NextResponse.json(todo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const result = await prisma.todos.deleteMany({ where: { id, user_id: userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }
  await deleteRecordEventFromGoogle(userId, id);
  return new NextResponse(null, { status: 204 });
}
