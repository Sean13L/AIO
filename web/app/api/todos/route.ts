import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { todoCreateSchema } from "@/lib/validation";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const todos = await prisma.todos.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
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

  const todo = await prisma.todos.create({
    data: { user_id: userId, title: parsed.data.title },
  });
  return NextResponse.json(todo, { status: 201 });
}
