"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api } from "@/lib/api";
import { formatDue } from "@/lib/dates";
import type { Lecture } from "@/lib/types";

const PREVIEW_STATUS_LABELS: Record<Lecture["preview_status"], string> = {
  not_generated: "Not generated yet",
  generated: "Ready to view",
  viewed: "Viewed",
};

export default function LecturePage({
  params,
}: {
  params: Promise<{ id: string; lectureId: string }>;
}) {
  const { id: courseId, lectureId } = use(params);
  const { email, ready } = useCurrentUser();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setLecture(await api.getLecture(email, lectureId));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, lectureId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!email || !file) return;
    setUploading(true);
    try {
      await api.uploadLectureSlides(email, lectureId, file);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!email) return;
    setGenerating(true);
    try {
      await api.generateLecturePreview(email, lectureId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>Enter your email above to view this lecture.</p>
      </div>
    );
  }
  if (!lecture) return <p className="muted">Loading…</p>;

  return (
    <div>
      <p>
        <Link href={`/courses/${courseId}`}>&larr; Back to course</Link>
      </p>
      {error && <p className="error">{error}</p>}

      <h1>
        Lecture{lecture.week_number ? ` — Week ${lecture.week_number}` : ""}
        <span className="badge">{PREVIEW_STATUS_LABELS[lecture.preview_status]}</span>
      </h1>
      <p className="muted">{formatDue({ due_at: lecture.scheduled_at, is_datetime: true })}</p>

      <div className="card">
        <h2>Syllabus topics</h2>
        <p>{lecture.topics ?? "No topic description extracted for this session."}</p>
      </div>

      <div className="card">
        <h2>Slides</h2>
        {lecture.slides_url ? (
          <p>
            <a href={lecture.slides_url} target="_blank" rel="noreferrer">
              View uploaded slides
            </a>
          </p>
        ) : (
          <p className="muted">No slides uploaded yet for this session.</p>
        )}
        <form className="inline" onSubmit={handleUpload}>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" />
          <button type="submit" disabled={uploading}>
            {lecture.slides_url ? "Replace slides" : "Upload slides"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Pre-lecture preview</h2>
        {lecture.preview_content ? (
          <p style={{ whiteSpace: "pre-wrap" }}>{lecture.preview_content}</p>
        ) : (
          <p className="muted">
            No preview generated yet. It leans on the uploaded slides when available, and falls
            back to the syllabus topic description alone otherwise.
          </p>
        )}
        <button onClick={handleGenerate} disabled={generating}>
          {generating
            ? "Generating…"
            : lecture.preview_content
              ? "Regenerate preview"
              : "Generate preview"}
        </button>
      </div>
    </div>
  );
}
