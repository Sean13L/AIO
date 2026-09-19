import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { todoCreateSchema } from "@/lib/validation";
import { toTimestamp } from "@/lib/timestamp";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Dated todos first (soonest deadline first), undated ones after — same
  // "scheduled vs. someday" split Apple Reminders uses. Postgres sorts NULL
  // last in ASC order by default, which is exactly this order for free.
  const todos = await prisma.todos.findMany({
    where: { user_id: userId },
    orderBy: [{ due_at: "asc" }, { created_at: "asc" }],
  });
  return NextResponse.json(todos);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = todoCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, due_date, due_time } = parsed.data;
  const todo = await prisma.todos.create({
    data: {
      user_id: userId,
      title,
      due_at: due_date ? toTimestamp(due_date, due_time ?? null) : null,
      is_datetime: Boolean(due_date && due_time),
    },
  });
  return NextResponse.json(todo, { status: 201 });
}
