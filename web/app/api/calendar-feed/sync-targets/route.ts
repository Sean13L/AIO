import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateFeedForUser } from "@/lib/calendarFeed";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Explicit select — never return google_access_token/google_refresh_token
  // to the client.
  const targets = await prisma.calendar_sync_targets.findMany({
    where: { calendar_feeds: { user_id: userId } },
    select: { id: true, feed_id: true, target_type: true, label: true, created_at: true },
    orderBy: { created_at: "asc" },
  });
  return NextResponse.json(targets);
}

const createSchema = z.object({ label: z.string().min(1) });

// Only 'ics_subscriber' targets can be created here. A 'google_oauth'
// target is created by the OAuth callback in app/api/calendar-feed/google/
// instead, since it needs a real token exchange, not just a label. A label
// doesn't create a separate feed; it just tracks who the student has
// shared the one feed URL with.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const feed = await getOrCreateFeedForUser(userId);
  const target = await prisma.calendar_sync_targets.create({
    data: { feed_id: feed.id, target_type: "ics_subscriber", label: parsed.data.label },
  });
  return NextResponse.json(target, { status: 201 });
}
