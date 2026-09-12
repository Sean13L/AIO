import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateFeedForUser } from "@/lib/calendarFeed";

// Authenticated: returns (creating on first use) the caller's subscribable
// .ics feed URL. The URL itself carries the auth (an unguessable token),
// since calendar apps polling it can't send a session cookie for this user.
export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const feed = await getOrCreateFeedForUser(userId);
  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return NextResponse.json({ url: `${base}/calendar/${feed.feed_token}.ics` });
}
