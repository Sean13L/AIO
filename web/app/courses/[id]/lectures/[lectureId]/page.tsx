"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import { formatDue } from "@/lib/dates";
import type { Lecture } from "@/lib/types";
import { PREVIEW_STATUS_TAG } from "@/lib/uiColors";
import { useLectureTranscription } from "@/lib/useLectureTranscription";

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
  const { email, ready } = useAuthGate();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryUsedMock, setSummaryUsedMock] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setLecture(await api.getLecture(lectureId));
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
      await api.uploadLectureSlides(lectureId, file);
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
      await api.generateLecturePreview(lectureId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  // Stable across renders (deps are just ids) so the transcription hook's
  // autosave interval isn't torn down and recreated on every keystroke-level
  // state update while live text is streaming in.
  const saveTranscript = useCallback(
    (transcript: string | null) => {
      if (!email) return;
      api
        .saveLectureTranscript(lectureId, transcript)
        .then((updated) => setLecture(updated))
        .catch((err) => setError((err as Error).message));
    },
    [email, lectureId]
  );

  const transcription = useLectureTranscription({
    initialTranscript: lecture?.transcript ?? "",
    onSave: saveTranscript,
  });

  // Auto-scrolls the transcript panel to the newest text as it comes in,
  // whether from live recognition or the final chunk landing on stop.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcription.finalTranscript, transcription.interimTranscript]);

  async function handleGenerateSummary() {
    if (!email) return;
    setSummarizing(true);
    try {
      const { usedMock, ...updated } = await api.generateLectureSummary(lectureId);
      setLecture(updated);
      setSummaryUsedMock(usedMock);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSummarizing(false);
    }
  }

  function handleClearTranscript() {
    if (!confirm("Clear this lecture's transcript? This also clears its summary.")) return;
    transcription.clear();
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to view this lecture.
        </p>
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
        Lecture{lecture.week_number ? ` — Week ${lecture.week_number}` : ""}{" "}
        <span className={`tag ${PREVIEW_STATUS_TAG[lecture.preview_status]}`}>
          {PREVIEW_STATUS_LABELS[lecture.preview_status]}
        </span>
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

      <div className="card">
        <h2>
          Live transcript
          {transcription.isRecording && (
            <span className="tag tag-rose" style={{ marginLeft: "0.6rem" }}>
              <span className="recording-dot" aria-hidden="true" /> Recording
            </span>
          )}
        </h2>

        {!transcription.isSupported ? (
          <p className="muted">
            Live transcription isn&apos;t supported in this browser. Try Chrome or Edge on
            desktop.
          </p>
        ) : (
          <>
            <p className="muted">
              Transcribes as you speak, using this browser&apos;s built-in speech recognition —
              nothing is uploaded until you stop (or every 20s while recording, so a long lecture
              isn&apos;t lost to a closed tab).
            </p>
            {transcription.error && <p className="error">{transcription.error}</p>}

            {(transcription.finalTranscript || transcription.interimTranscript) && (
              <div ref={transcriptScrollRef} className="transcript-panel">
                <span style={{ whiteSpace: "pre-wrap" }}>{transcription.finalTranscript}</span>
                {transcription.interimTranscript && (
                  <span className="transcript-interim">
                    {transcription.finalTranscript ? " " : ""}
                    {transcription.interimTranscript}
                  </span>
                )}
              </div>
            )}

            <div className="actions" style={{ marginTop: "0.85rem" }}>
              {transcription.isRecording ? (
                <button type="button" className="danger" onClick={transcription.stop}>
                  Stop recording
                </button>
              ) : (
                <button type="button" onClick={transcription.start}>
                  {transcription.finalTranscript ? "Resume recording" : "Start recording"}
                </button>
              )}
              {!transcription.isRecording && transcription.finalTranscript && (
                <button type="button" className="secondary" onClick={handleClearTranscript}>
                  Clear transcript
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Lecture summary</h2>
        {lecture.transcript_summary ? (
          <>
            {summaryUsedMock && (
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
                ⚠ No AI key is configured, so this used a basic offline summarizer instead of real
                AI — it&apos;s just a snippet of the transcript, not an actual summary.
              </p>
            )}
            <p style={{ whiteSpace: "pre-wrap" }}>{lecture.transcript_summary}</p>
          </>
        ) : (
          <p className="muted">
            No summary yet. Record (or finish recording) a transcript above, then generate one.
          </p>
        )}
        <button
          onClick={handleGenerateSummary}
          disabled={summarizing || !lecture.transcript?.trim()}
        >
          {summarizing
            ? "Summarizing…"
            : lecture.transcript_summary
              ? "Regenerate summary"
              : "Generate summary"}
        </button>
      </div>
    </div>
  );
}
