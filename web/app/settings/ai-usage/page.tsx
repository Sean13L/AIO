"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { AiUsageError, AiUsageSummary } from "@/lib/types";
import { useTimeFormatPreference, type TimeFormatPreference } from "@/lib/timeFormat";

// Names for gemini_errors.feature (lib/geminiErrors.ts GeminiFeature) as
// users know those features.
const FEATURE_LABELS: Record<string, string> = {
  syllabus_extraction: "Syllabus upload",
  lecture_preview: "Lecture preview",
  lecture_preview_cron: "Lecture preview (automatic)",
  transcript_summary: "Lecture summary",
  study_guide: "Study guide",
  flashcards: "Flashcards",
  quiz: "Quiz",
};

function problemFor(status: number | null): { label: string; tag: string; explanation: string } {
  if (status === 429) {
    return {
      label: "Limit reached",
      tag: "tag-amber",
      explanation: "Gemini's free-tier request limit for that model was used up at the time.",
    };
  }
  if (status !== null && status >= 500) {
    return {
      label: "Gemini busy",
      tag: "tag-blue",
      explanation: "Google's servers were overloaded — nothing on Studdy's side.",
    };
  }
  if (status !== null && status >= 400) {
    return {
      label: "Request rejected",
      tag: "tag-rose",
      explanation: "Gemini refused the request itself, so retrying on another model wouldn't help.",
    };
  }
  return { label: "Other error", tag: "tag-slate", explanation: "The request didn't complete." };
}

function formatWhen(iso: string, timeFormat: TimeFormatPreference): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
}

function UsageChart({ history, limit }: { history: AiUsageSummary["history"]; limit: number }) {
  // Scale to the busiest day (not the limit), so light use still shows —
  // with a floor so one request doesn't draw a full-height bar.
  const scale = Math.max(...history.map((d) => d.count), 5);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="usage-chart"
      role="img"
      aria-label={`AI requests per day for the last ${history.length} days: ${history
        .map((d) => `${d.date} ${d.count}`)
        .join(", ")}`}
    >
      {history.map((day) => {
        const date = new Date(`${day.date}T00:00:00Z`);
        const isToday = day.date === todayKey;
        return (
          <div key={day.date} className="usage-chart-col" title={`${day.date}: ${day.count} of ${limit}`}>
            <div className="usage-chart-track">
              <div
                className="usage-chart-bar"
                style={{ height: `${(day.count / scale) * 100}%` }}
                data-today={isToday || undefined}
              >
                {day.count > 0 && <span className="usage-chart-value">{day.count}</span>}
              </div>
            </div>
            {/* Date numbers only — "Today" doesn't fit a column at phone
                width. Today is the bold label and the solid bar. */}
            <span className="usage-chart-label" data-today={isToday || undefined}>
              {date.getUTCDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ErrorRow({ error, timeFormat }: { error: AiUsageError; timeFormat: TimeFormatPreference }) {
  const problem = problemFor(error.status);
  return (
    <li className="usage-error">
      <div className="usage-error-head">
        <span className={`tag ${problem.tag}`}>{problem.label}</span>
        <strong>{FEATURE_LABELS[error.feature] ?? error.feature}</strong>
        <span className="muted">{formatWhen(error.created_at, timeFormat)}</span>
      </div>
      <details>
        <summary>Details</summary>
        <p className="muted">
          {problem.explanation} Model: {error.model}
          {error.status !== null && ` · HTTP ${error.status}`}
        </p>
        <p className="usage-error-message">{error.message}</p>
      </details>
    </li>
  );
}

export default function AiUsagePage() {
  const { email, ready } = useAuthGate();
  const timeFormat = useTimeFormatPreference();
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    api
      .getAiUsage()
      .then(setUsage)
      .catch((err) => setError((err as Error).message));
  }, [email]);

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to view your AI usage.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link href="/settings">&larr; Settings</Link>
      </p>
      <h1>AI usage</h1>
      {error && <p className="error">{error}</p>}
      {!usage && !error && <p className="muted">Loading…</p>}

      {usage && (
        <>
          <div className="card">
            <h2>Today</h2>
            <p className="usage-figure">
              <strong>{usage.today.used}</strong> of {usage.limit} AI requests used
            </p>
            <div
              className="usage-meter"
              role="meter"
              aria-label="AI requests used today"
              aria-valuemin={0}
              aria-valuemax={usage.limit}
              aria-valuenow={usage.today.used}
            >
              <div
                className="usage-meter-fill"
                style={{ width: `${(usage.today.used / usage.limit) * 100}%` }}
                data-level={
                  usage.today.used >= usage.limit
                    ? "full"
                    : usage.today.used >= usage.limit * 0.8
                      ? "high"
                      : undefined
                }
              />
            </div>
            <p className="muted">
              Resets at{" "}
              {new Date(usage.resets_at).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                hour12: timeFormat === "12h",
              })}{" "}
              your time (midnight UTC).
              {usage.today.blocked > 0 &&
                ` ${usage.today.blocked} more ${usage.today.blocked === 1 ? "request was" : "requests were"} turned away after the limit was reached.`}
            </p>
            <p className="muted" style={{ marginTop: "0.6rem" }}>
              Counts syllabus uploads, lecture previews and summaries, study guides, flashcards, and
              quizzes. Previews Studdy prepares automatically before a lecture don&apos;t count, and
              requests that fail are given back.
            </p>
          </div>

          <div className="card">
            <h2>Last {usage.history.length} days</h2>
            <p className="muted" style={{ marginBottom: "0.75rem" }}>
              AI requests per day (UTC). Today is the solid bar.
            </p>
            <UsageChart history={usage.history} limit={usage.limit} />
          </div>

          <div className="card">
            <h2>Failed requests</h2>
            {usage.error_total === 0 ? (
              <p className="muted">No failed AI requests in the last 30 days.</p>
            ) : (
              <>
                <p className="muted" style={{ marginBottom: "0.75rem" }}>
                  {usage.error_total} in the last 30 days
                  {usage.error_total > usage.errors.length &&
                    ` (showing the latest ${usage.errors.length})`}
                  . When Gemini is busy Studdy retries on a backup model, so an entry here means one
                  attempt failed — not necessarily the whole action.
                </p>
                <ul className="usage-error-list">
                  {usage.errors.map((e) => (
                    <ErrorRow key={e.id} error={e} timeFormat={timeFormat} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
