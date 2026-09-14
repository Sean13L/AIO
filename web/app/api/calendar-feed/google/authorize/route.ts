import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { buildAuthorizeUrl, googleCalendarConfigured } from "@/lib/calendar/googleCalendar";

const STATE_COOKIE = "google_calendar_oauth_state";

// Kicks off the "connect my Google Calendar" flow — separate from
// NextAuth's own Google sign-in provider, since sign-in shouldn't require
// calendar consent and the calendar scope shouldn't be tied to the login
// session's token lifecycle. State is a random value round-tripped via an
// httpOnly cookie to protect the callback from CSRF.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!googleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar isn't configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing)" },
      { status: 501 }
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
