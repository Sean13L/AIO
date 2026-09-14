import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { getOrCreateFeedForUser } from "@/lib/calendarFeed";
import {
  exchangeCodeForTokens,
  getGoogleAccountEmail,
  syncUserCalendarToGoogle,
} from "@/lib/calendar/googleCalendar";

const STATE_COOKIE = "google_calendar_oauth_state";

function redirectHome(req: NextRequest, status: "connected" | "error") {
  const url = new URL("/", req.nextUrl.origin);
  url.searchParams.set("google_calendar", status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  // Re-derive the user from the session, never from `state` — state is only
  // a CSRF check, not an identity claim.
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  const res = code && state && cookieState && state === cookieState
    ? await handleSuccess(req, userId, code)
    : redirectHome(req, "error");

  res.cookies.delete(STATE_COOKIE);
  return res;
}

async function handleSuccess(req: NextRequest, userId: string, code: string) {
  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getGoogleAccountEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const feed = await getOrCreateFeedForUser(userId);
    // Owner-only v1 (see CLAUDE.md): at most one google_oauth target per
    // feed, so reconnecting updates the existing row instead of piling up
    // duplicates.
    const existing = await prisma.calendar_sync_targets.findFirst({
      where: { feed_id: feed.id, target_type: "google_oauth" },
    });

    const data = {
      target_type: "google_oauth" as const,
      label: email ?? "Google Calendar",
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token ?? existing?.google_refresh_token ?? null,
      google_token_expires_at: expiresAt,
    };

    if (existing) {
      await prisma.calendar_sync_targets.update({ where: { id: existing.id }, data });
    } else {
      await prisma.calendar_sync_targets.create({ data: { feed_id: feed.id, ...data } });
    }

    await syncUserCalendarToGoogle(userId);
    return redirectHome(req, "connected");
  } catch (err) {
    console.error("[google calendar callback]", err);
    return redirectHome(req, "error");
  }
}
