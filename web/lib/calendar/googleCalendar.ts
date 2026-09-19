// Direct Google Calendar push for the account owner's own calendar — the
// v1 scope for the "instant sync" option CLAUDE.md flags as an alternative
// to the universal .ics subscribe-by-URL feed (icsBuilder.ts). Only the
// signed-in user's own Google Calendar is supported; a shared recipient
// (parent, study partner) still uses the .ics link, same as before.
//
// Uses raw fetch against Google's OAuth and Calendar REST APIs rather than
// the `googleapis` package — same "no dependency for a simple REST call"
// choice already made for Resend in sendVerificationEmail.ts.

import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
// "email" is on top of the calendar scope purely so the connected UI can
// show which Google account is linked (getGoogleAccountEmail below) — the
// userinfo endpoint 403s without it, since scopes aren't implied by each
// other.
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events email";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function callbackRedirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/calendar-feed/google/callback`;
}

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: callbackRedirectUri(),
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    // Forces Google to re-issue a refresh_token even on a repeat connect —
    // without this, a second authorization for the same Google account
    // often omits it, leaving us with an access token we can't renew.
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: callbackRedirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.email === "string" ? data.email : null;
}

type SyncTarget = {
  id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: Date | null;
};

// Refreshes 60s ahead of actual expiry so a token doesn't die mid-request.
async function getValidAccessToken(target: SyncTarget): Promise<string | null> {
  if (!target.google_refresh_token) return target.google_access_token;

  const expiresSoon =
    !target.google_token_expires_at || target.google_token_expires_at.getTime() - 60_000 < Date.now();
  if (!expiresSoon) return target.google_access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: target.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error(`[googleCalendar] token refresh failed for target ${target.id}: ${res.status}`);
    return null;
  }

  const data: GoogleTokenResponse = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await prisma.calendar_sync_targets.update({
    where: { id: target.id },
    data: { google_access_token: data.access_token, google_token_expires_at: expiresAt },
  });
  return data.access_token;
}

// Google event ids must match ^[a-v0-9]{5,1024}$ — a UUID's hex digits
// (0-9a-f) are already a subset of that alphabet, so stripping the hyphens
// gives a valid, stable, collision-free id without a separate mapping table.
function eventIdForRecord(id: string): string {
  return id.replace(/-/g, "");
}

interface EventInput {
  eventId: string;
  summary: string;
  description: string | null;
  url: string;
  start: Date;
  allDay: boolean;
  durationMinutes: number;
}

function eventBody(event: EventInput) {
  const base: Record<string, unknown> = {
    summary: event.summary,
    description: [event.description, event.url].filter(Boolean).join("\n\n"),
    source: { title: "AI Syllabus Assistant", url: event.url },
  };
  if (event.allDay) {
    const dateOnly = event.start.toISOString().slice(0, 10);
    const end = new Date(event.start.getTime() + 24 * 60 * 60_000).toISOString().slice(0, 10);
    return { ...base, start: { date: dateOnly }, end: { date: end } };
  }
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000);
  return {
    ...base,
    start: { dateTime: event.start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

async function upsertEvent(accessToken: string, event: EventInput): Promise<void> {
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const body = eventBody(event);
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const updateRes = await fetch(`${base}/${event.eventId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (updateRes.ok) return;
  if (updateRes.status !== 404 && updateRes.status !== 410) {
    throw new Error(`Google Calendar event update failed: ${updateRes.status} ${await updateRes.text()}`);
  }

  const insertRes = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: event.eventId, ...body }),
  });
  if (!insertRes.ok) {
    throw new Error(`Google Calendar event insert failed: ${insertRes.status} ${await insertRes.text()}`);
  }
}

async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // 404/410/200/204 all mean "not there anymore" — fine either way.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar event delete failed: ${res.status} ${await res.text()}`);
  }
}

const ITEM_DURATION_MINUTES = 30;
const LECTURE_DURATION_MINUTES = 60;
const TODO_DURATION_MINUTES = 30;

async function googleSyncTargetsForUser(userId: string): Promise<SyncTarget[]> {
  return prisma.calendar_sync_targets.findMany({
    where: { target_type: "google_oauth", calendar_feeds: { user_id: userId } },
    select: {
      id: true,
      google_access_token: true,
      google_refresh_token: true,
      google_token_expires_at: true,
    },
  });
}

// Best-effort, full reconcile: pushes every item/lecture the user currently
// has as an upsert. Cheap at the scale a single student's courses run at,
// and simpler/more correct than diffing individual mutations. Never throws —
// a Google API hiccup shouldn't block the CRUD operation it's attached to,
// same "best effort" precedent as deleteFile in lib/storage.ts.
export async function syncUserCalendarToGoogle(userId: string): Promise<void> {
  const targets = await googleSyncTargetsForUser(userId);
  if (targets.length === 0) return;

  const webBaseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const [items, lectures, todos] = await Promise.all([
    prisma.items.findMany({
      where: { courses: { user_id: userId } },
      include: { courses: { select: { course_code: true } } },
    }),
    prisma.lectures.findMany({
      where: { courses: { user_id: userId } },
      include: { courses: { select: { course_code: true } } },
    }),
    // Only todos the user has opted into showing on their calendar — see
    // CLAUDE.md's To Do List note. due_at is never null here in practice
    // (the API enforces show_on_calendar requires a deadline), but the
    // filter is explicit rather than assumed.
    prisma.todos.findMany({
      where: { user_id: userId, show_on_calendar: true, due_at: { not: null } },
    }),
  ]);

  const events: EventInput[] = [
    ...items.map((item) => ({
      eventId: eventIdForRecord(item.id),
      summary: `${item.courses.course_code}: ${item.name}`,
      description: [item.type, item.weight ? `Weight: ${item.weight}` : null, item.notes]
        .filter(Boolean)
        .join(" — "),
      url: `${webBaseUrl}/courses/${item.course_id}`,
      start: item.due_at,
      allDay: !item.is_datetime,
      durationMinutes: ITEM_DURATION_MINUTES,
    })),
    ...lectures.map((lecture) => ({
      eventId: eventIdForRecord(lecture.id),
      summary: `${lecture.courses.course_code}: Lecture${
        lecture.week_number ? ` (Week ${lecture.week_number})` : ""
      }`,
      description: lecture.topics,
      url: `${webBaseUrl}/courses/${lecture.course_id}/lectures/${lecture.id}`,
      start: lecture.scheduled_at,
      allDay: false,
      durationMinutes: LECTURE_DURATION_MINUTES,
    })),
    ...todos.map((todo) => ({
      eventId: eventIdForRecord(todo.id),
      summary: todo.title,
      description: null,
      // No dedicated todo detail page — links to the list itself.
      url: `${webBaseUrl}/todos`,
      start: todo.due_at!,
      allDay: !todo.is_datetime,
      durationMinutes: TODO_DURATION_MINUTES,
    })),
  ];

  for (const target of targets) {
    try {
      const accessToken = await getValidAccessToken(target);
      if (!accessToken) continue;
      for (const event of events) {
        await upsertEvent(accessToken, event);
      }
    } catch (err) {
      console.error(`[googleCalendar] sync failed for target ${target.id}:`, err);
    }
  }
}

// Deletes one item/lecture's event from every connected Google Calendar —
// needed because a full resync only ever adds/updates, it never notices a
// row that's gone. Best-effort, same reasoning as above.
export async function deleteRecordEventFromGoogle(userId: string, recordId: string): Promise<void> {
  const targets = await googleSyncTargetsForUser(userId);
  if (targets.length === 0) return;

  const eventId = eventIdForRecord(recordId);
  for (const target of targets) {
    try {
      const accessToken = await getValidAccessToken(target);
      if (!accessToken) continue;
      await deleteEvent(accessToken, eventId);
    } catch (err) {
      console.error(`[googleCalendar] event delete failed for target ${target.id}:`, err);
    }
  }
}

// Deletes every item/lecture event for one target — used when the user
// disconnects Google Calendar, so old events don't linger forever.
export async function deleteAllEventsForTarget(
  target: SyncTarget,
  recordIds: string[]
): Promise<void> {
  try {
    const accessToken = await getValidAccessToken(target);
    if (!accessToken) return;
    for (const recordId of recordIds) {
      await deleteEvent(accessToken, eventIdForRecord(recordId));
    }
  } catch (err) {
    console.error(`[googleCalendar] cleanup failed for target ${target.id}:`, err);
  }
}
