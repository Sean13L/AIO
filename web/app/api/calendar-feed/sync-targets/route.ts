import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateFeedForUser } from "@/lib/calendarFeed";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const targets = await prisma.calendar_sync_targets.findMany({
    where: { calendar_feeds: { user_id: userId } },
    orderBy: { created_at: "asc" },
  });
  return NextResponse.json(targets);
}

const createSchema = z.object({ label: z.string().min(1) });

// Only 'ics_subscriber' targets can be created here — direct Google OAuth
// push isn't implemented (see CLAUDE.md: "v2 enhancement if instant sync
// turns out to matter"). A label doesn't create a separate feed; it just
// tracks who the student has shared the one feed URL with.
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
