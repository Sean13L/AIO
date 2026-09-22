"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { StudyGuideSummary } from "@/lib/types";

export default function StudyGuidesPage() {
  const { email, ready } = useAuthGate();
  const [guides, setGuides] = useState<StudyGuideSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setGuides(await api.listStudyGuides());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function handleDelete(id: string) {
    if (!email) return;
    if (!confirm("Delete this study guide?")) return;
    try {
      await api.deleteStudyGuide(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to see your study guides.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.85rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Study Guides</h1>
          <p className="muted">
            Pick specific lectures — and which of their topics, slides, or transcript to draw
            from — and generate a combined study guide from them.
          </p>
        </div>
        <Link href="/study-guides/new">
          <button type="button">+ New study guide</button>
        </Link>
      </div>
      {error && <p className="error">{error}</p>}

      {guides === null ? (
        <p className="muted">Loading…</p>
      ) : guides.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            📚
          </span>
          <h3>No study guides yet</h3>
          <p>Select a few lectures and generate one to get started.</p>
          <div className="actions">
            <Link href="/study-guides/new">
              <button type="button">+ New study guide</button>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="course-list">
          {guides.map((guide) => (
            <li key={guide.id}>
              <Link href={`/study-guides/${guide.id}`} style={{ flex: 1 }}>
                <strong>{guide.title}</strong>
                <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.15rem" }}>
                  {guide.lecture_count} lecture{guide.lecture_count === 1 ? "" : "s"} ·{" "}
                  {new Date(guide.created_at).toLocaleDateString()}
                  {guide.used_mock && " · offline parser"}
                </div>
              </Link>
              <button className="danger" onClick={() => handleDelete(guide.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
