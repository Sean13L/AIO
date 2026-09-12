"use client";

import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { CalendarSyncTarget } from "@/lib/types";

export function CalendarFeedCard() {
  const { email } = useAuthGate();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

          <h3 style={{ marginBottom: "0.25rem" }}>Shared with</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            It&apos;s the same read-only link for everyone — anyone you give it to
            (a parent, a study partner) can subscribe. This list is just so you can
            keep track of who has it.
          </p>

          {targets && targets.length > 0 && (
            <ul className="course-list" style={{ marginBottom: "0.75rem" }}>
              {targets.map((target) => (
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

          <p className="muted">
            Want instant sync straight into someone&apos;s Google Calendar instead of a
            subscribed link? That needs a Google account connection (OAuth) that
            isn&apos;t set up yet — this app currently only supports the universal
            subscribe-by-URL feed above.
          </p>
        </>
      )}
    </div>
  );
}
