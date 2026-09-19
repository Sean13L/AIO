import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIcsFeed } from "@/lib/calendar/icsBuilder";

// Public — no session check. The feed_token in the URL is the auth:
// unguessable, one per user. Calendar apps subscribe to
// /calendar/<token>.ics; Next.js's dynamic segment captures the ".ics"
// suffix as part of the param, so it's stripped below.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/, "");

  const feed = await prisma.calendar_feeds.findUnique({ where: { feed_token: token } });
  if (!feed) {
    return new NextResponse("Feed not found", { status: 404 });
  }

  const [items, lectures, todos] = await Promise.all([
    prisma.items.findMany({
      where: { courses: { user_id: feed.user_id } },
      include: { courses: { select: { course_code: true } } },
      orderBy: { due_at: "asc" },
    }),
    prisma.lectures.findMany({
      where: { courses: { user_id: feed.user_id } },
      include: { courses: { select: { course_code: true } } },
      orderBy: { scheduled_at: "asc" },
    }),
    prisma.todos.findMany({
      where: { user_id: feed.user_id, show_on_calendar: true, due_at: { not: null } },
      orderBy: { due_at: "asc" },
    }),
  ]);

  const flattenedItems = items.map(({ courses, ...item }) => ({
    ...item,
    course_code: courses.course_code,
  }));
  const flattenedLectures = lectures.map(({ courses, ...lecture }) => ({
    ...lecture,
    course_code: courses.course_code,
  }));

  const webBaseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const ics = buildIcsFeed({
    items: flattenedItems,
    lectures: flattenedLectures,
    todos: todos.map((todo) => ({ ...todo, due_at: todo.due_at! })),
    webBaseUrl,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="calendar.ics"',
    },
  });
}
