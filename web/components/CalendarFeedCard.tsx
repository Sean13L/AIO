"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { CalendarSyncTarget } from "@/lib/types";

export function CalendarFeedCard() {
  const { email } = useAuthGate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<"connected" | "error" | null>(null);
  const [targets, setTargets] = useState<CalendarSyncTarget[] | null>(null);
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);

  async function refreshTargets() {
    if (!email) return;
    try {
      setTargets(await api.listSyncTargets());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    if (!email) return;
    api
      .getCalendarFeed()
      .then((res) => setUrl(res.url))
      .catch((err) => setError((err as Error).message));
    refreshTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Picks up the ?google_calendar=connected|error redirect from
  // /api/calendar-feed/google/callback, then strips it from the URL.
  useEffect(() => {
    const status = searchParams.get("google_calendar");
    if (status === "connected" || status === "error") {
      setGoogleStatus(status);
      router.replace("/", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  async function handleAddTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !label.trim()) return;
    setAdding(true);
    try {
      await api.addSyncTarget(label.trim());
      setLabel("");
      await refreshTargets();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveTarget(targetId: string) {
    if (!email) return;
    try {
      await api.removeSyncTarget(targetId);
      await refreshTargets();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const googleTarget = targets?.find((t) => t.target_type === "google_oauth") ?? null;
  const icsTargets = targets?.filter((t) => t.target_type === "ics_subscriber") ?? [];

  return (
    <div className="card">
      <h2>Subscribe to your calendar</h2>
      {error && <p className="error">{error}</p>}
      {googleStatus === "connected" && (
        <p className="success">Google Calendar connected — your items and lectures are synced.</p>
      )}
      {googleStatus === "error" && (
        <p className="error">Couldn&apos;t connect Google Calendar. Please try again.</p>
      )}
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

          <h3 style={{ marginBottom: "0.25rem" }}>Shared with</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            It&apos;s the same read-only link for everyone — anyone you give it to
            (a parent, a study partner) can subscribe. This list is just so you can
            keep track of who has it.
          </p>

          {icsTargets.length > 0 && (
            <ul className="course-list" style={{ marginBottom: "0.75rem" }}>
              {icsTargets.map((target) => (
                <li key={target.id}>
                  <span>{target.label}</span>
                  <button className="danger" onClick={() => handleRemoveTarget(target.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="inline" onSubmit={handleAddTarget}>
            <label>
              Name
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Mom, study group…"
              />
            </label>
            <button type="submit" disabled={adding}>
              Add recipient
            </button>
          </form>

          <h3 style={{ marginBottom: "0.25rem" }}>Instant sync</h3>
          {googleTarget ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Connected as <strong>{googleTarget.label}</strong> — your items and lectures push
              here automatically, no waiting on a subscribed feed to refresh.{" "}
              <button className="danger" onClick={() => handleRemoveTarget(googleTarget.id)}>
                Disconnect
              </button>
            </p>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              Want instant sync straight into your own Google Calendar instead of waiting on a
              subscribed feed to refresh?{" "}
              <a href="/api/calendar-feed/google/authorize">Connect Google Calendar</a>. This
              connects your own calendar only — a parent or study partner still uses the
              subscribe-by-URL link above.
            </p>
          )}
        </>
      )}
    </div>
  );
}
