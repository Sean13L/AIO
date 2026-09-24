"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import { formatDue } from "@/lib/dates";
import type { Lecture } from "@/lib/types";
import { PREVIEW_STATUS_TAG } from "@/lib/uiColors";
import { useLectureTranscription } from "@/lib/useLectureTranscription";
import { useTimeFormatPreference } from "@/lib/timeFormat";
import { Markdown } from "@/components/Markdown";

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
  const timeFormat = useTimeFormatPreference();
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryUsedMock, setSummaryUsedMock] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [importingNotes, setImportingNotes] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<number | null>(null);

  // Seed the notes editor once per lecture, not on every refresh() — other
  // actions on this page (uploading slides, generating a preview) refresh
  // the lecture too, and must not clobber notes the user hasn't saved yet.
  const loadedLectureId = lecture?.id;
  useEffect(() => {
    if (lecture) setNotesDraft(lecture.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedLectureId]);

  const notesDirty = lecture !== null && notesDraft !== (lecture.notes ?? "");

  async function handleSaveNotes() {
    if (!email) return;
    setSavingNotes(true);
    setError(null);
    try {
      const updated = await api.saveLectureNotes(lectureId, notesDraft.trim() ? notesDraft : null);
      setLecture(updated);
      setNotesDraft(updated.notes ?? "");
      setNotesSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleImportNotes(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!email || files.length === 0) return;
    setImportingNotes(true);
    setError(null);
    try {
      // The import appends to the *stored* notes server-side, so save any
      // unsaved typing first or it would be overwritten by the response.
      if (notesDirty) await api.saveLectureNotes(lectureId, notesDraft.trim() ? notesDraft : null);
      const updated = await api.importLectureNotes(lectureId, files);
      setLecture(updated);
      setNotesDraft(updated.notes ?? "");
      setNotesSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImportingNotes(false);
    }
  }

  async function handleDeleteLecture() {
    if (!email) return;
    if (!confirm("Delete this lecture, including its slides, transcript, and notes?")) return;
    try {
      await api.deleteLecture(lectureId);
      router.push(`/courses/${courseId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

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
      <p className="muted">
        {formatDue({ due_at: lecture.scheduled_at, is_datetime: true }, timeFormat)}
      </p>

      <div className="card">
        <h2>{lecture.source === "manual" ? "Topics" : "Syllabus topics"}</h2>
        <p>
          {lecture.topics ??
            (lecture.source === "manual"
              ? "No topics entered for this session."
              : "No topic description extracted for this session.")}
        </p>
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
        <h2>Your notes</h2>
        <p className="muted" style={{ marginBottom: "0.6rem" }}>
          Type or paste your own notes for this session, or import them from a file (.pdf, .docx,
          .txt, .md — the text gets added below). Available as a &quot;Notes&quot; option when
          building a study guide.
        </p>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          rows={8}
          style={{ width: "100%", marginBottom: "0.75rem" }}
          placeholder="Your notes from this lecture…"
        />
        <div className="actions" style={{ alignItems: "center" }}>
          <button type="button" onClick={handleSaveNotes} disabled={savingNotes || !notesDirty}>
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => notesFileInputRef.current?.click()}
            disabled={importingNotes}
          >
            {importingNotes ? "Importing…" : "Import from file"}
          </button>
          <input
            ref={notesFileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            multiple
            onChange={handleImportNotes}
            hidden
          />
          <span className="muted" style={{ fontSize: "0.82rem" }}>
            {notesDirty ? "Unsaved changes" : notesSavedAt ? "Saved" : ""}
          </span>
        </div>
      </div>

      <div className="card">
        <h2>Pre-lecture preview</h2>
        {lecture.preview_content ? (
          <Markdown>{lecture.preview_content}</Markdown>
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
            <Markdown>{lecture.transcript_summary}</Markdown>
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

      <button className="danger" onClick={handleDeleteLecture}>
        Delete lecture
      </button>
    </div>
  );
}
