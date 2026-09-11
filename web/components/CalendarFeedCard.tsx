"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api } from "@/lib/api";

export function CalendarFeedCard() {
  const { email } = useCurrentUser();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    api
      .getCalendarFeed(email)
      .then((res) => setUrl(res.url))
      .catch((err) => setError((err as Error).message));
  }, [email]);

  if (!email) return null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  }

  return (
    <div className="card">
      <h2>Subscribe to your calendar</h2>
      {error && <p className="error">{error}</p>}
      {url && (
        <>
          <form
            className="inline"
            onSubmit={(e) => e.preventDefault()}
            style={{ marginBottom: "0.5rem" }}
          >
            <input value={url} readOnly style={{ minWidth: "420px" }} />
            <button type="button" onClick={copy}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </form>
          <p className="muted">
            Paste this URL into Google Calendar, Outlook, or Apple Calendar as a
            &quot;subscribe by URL&quot; calendar. Deadlines are all-day unless the
            syllabus gave a specific time; lectures are always timed. Subscribed
            feeds refresh on the calendar provider&apos;s own schedule (often every
            few hours) — this is near-real-time, not instant.
          </p>
        </>
      )}
    </div>
  );
}
