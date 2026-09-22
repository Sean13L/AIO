"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { StudyGuideDetail } from "@/lib/types";
import { formatDue } from "@/lib/dates";
import { useTimeFormatPreference } from "@/lib/timeFormat";

export default function StudyGuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { email, ready } = useAuthGate();
  const router = useRouter();
  const timeFormat = useTimeFormatPreference();
  const [guide, setGuide] = useState<StudyGuideDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    api.getStudyGuide(id).then(setGuide).catch((err) => setError((err as Error).message));
  }, [email, id]);

  async function handleDelete() {
    if (!email) return;
    if (!confirm("Delete this study guide?")) return;
    try {
      await api.deleteStudyGuide(id);
      router.push("/study-guides");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to view this study guide.
        </p>
      </div>
    );
  }
  if (error) return <p className="error">{error}</p>;
  if (!guide) return <p className="muted">Loading…</p>;

  return (
    <div>
      <p>
        <Link href="/study-guides">&larr; Study guides</Link>
      </p>
      {error && <p className="error">{error}</p>}

      <h1>{guide.title}</h1>
      <p className="muted">Generated {new Date(guide.created_at).toLocaleString()}</p>

      {guide.used_mock && (
        <p
          className="muted"
          style={{
            background: "var(--color-warning-light)",
            color: "var(--color-warning)",
            padding: "0.6rem 0.8rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "0.75rem",
          }}
        >
          ⚠ No AI key is configured, so this used a basic offline generator instead of real AI —
          it&apos;s just excerpts of the source material, not an actual study guide.
        </p>
      )}

      <div className="card">
        <p style={{ whiteSpace: "pre-wrap" }}>{guide.content}</p>
      </div>

      <div className="card">
        <h2>Built from</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {guide.sources.map((source) => {
            const included = [
              source.included_topics && "topics",
              source.included_slides && "slides",
              source.included_transcript && "transcript",
            ].filter(Boolean);
            return (
              <li key={source.lecture_id}>
                <Link href={`/courses/${source.course_id}/lectures/${source.lecture_id}`}>
                  {source.course_code}
                </Link>
                {source.week_number ? ` — Week ${source.week_number}` : ""} —{" "}
                {formatDue({ due_at: source.scheduled_at, is_datetime: true }, timeFormat)}
                {included.length > 0 && (
                  <span className="muted"> ({included.join(", ")})</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <button className="danger" onClick={handleDelete}>
        Delete study guide
      </button>
    </div>
  );
}
