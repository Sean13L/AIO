import { NextRequest, NextResponse } from "next/server";

// Rate-limits requests to send a magic-link sign-in email — otherwise
// nothing stops repeated POSTs to NextAuth's built-in email-provider
// endpoint from spamming an inbox (or burning the Resend quota) for any
// address, since that endpoint requires no auth by design.
//
// In-memory, per-serverless-instance sliding window — not a distributed
// rate limiter (Vercel functions aren't guaranteed to share memory across
// invocations/instances), so a determined attacker distributing requests
// across cold starts can exceed this. It's a low-cost first line of
// defense appropriate for this app's traffic/threat level; swap in a
// shared store (e.g. Upstash Redis) if that stops being true.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(key, timestamps);

  // Bound memory: an unbounded Map would leak one entry per distinct IP
  // forever on a long-lived instance. Sweep occasionally rather than on
  // every request.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return timestamps.length > MAX_REQUESTS;
}

export function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many sign-in requests. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(WINDOW_MS / 1000) } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/signin/email"],
};
