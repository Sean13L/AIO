"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { LectureWithCourse } from "@/lib/types";
import { formatDue } from "@/lib/dates";
import { useTimeFormatPreference } from "@/lib/timeFormat";

interface ContentSelection {
  include_topics: boolean;
  include_slides: boolean;
  include_transcript: boolean;
  include_notes: boolean;
}

function hasSelectableContent(lecture: LectureWithCourse): boolean {
  return Boolean(
    lecture.topics ||
      lecture.slides_url ||
      lecture.transcript ||
      lecture.transcript_summary ||
      lecture.notes
  );
}

function defaultSelectionFor(lecture: LectureWithCourse): ContentSelection {
  // Only offer/default-check content types this lecture actually has.
  return {
    include_topics: Boolean(lecture.topics),
    include_slides: Boolean(lecture.slides_url),
    include_transcript: Boolean(lecture.transcript || lecture.transcript_summary),
    include_notes: Boolean(lecture.notes),
  };
}

export default function NewStudyGuidePage() {
  const { email, ready } = useAuthGate();
  const router = useRouter();
  const timeFormat = useTimeFormatPreference();
  const [lectures, setLectures] = useState<LectureWithCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, ContentSelection>>({});
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [notesText, setNotesText] = useState("");
  const [notesFiles, setNotesFiles] = useState<File[]>([]);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!email) return;
    api.listAllLectures().then(setLectures).catch((err) => setError((err as Error).message));
  }, [email]);

  const byCourse = useMemo(() => {
    const groups: { key: string; label: string; lectures: LectureWithCourse[] }[] = [];
    for (const lecture of lectures ?? []) {
      const key = lecture.course_id;
      const group = groups.find((g) => g.key === key);
      const label = `${lecture.course_code} — ${lecture.course_name}`;
      if (group) group.lectures.push(lecture);
      else groups.push({ key, label, lectures: [lecture] });
    }
    return groups;
  }, [lectures]);

  function toggleLecture(lecture: LectureWithCourse) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[lecture.id]) delete next[lecture.id];
      else next[lecture.id] = defaultSelectionFor(lecture);
      return next;
    });
  }

  function toggleContent(lectureId: string, key: keyof ContentSelection) {
    setSelections((prev) => {
      const current = prev[lectureId];
      if (!current) return prev;
      return { ...prev, [lectureId]: { ...current, [key]: !current[key] } };
    });
  }

  // Shared by both the global and per-course "Select all" / "Clear"
  // buttons — selecting skips lectures with nothing to select (same as
  // their individually-disabled checkbox), clearing just drops whichever of
  // the given lectures happen to be selected.
  function selectAll(lecturesToSelect: LectureWithCourse[]) {
    setSelections((prev) => {
      const next = { ...prev };
      for (const lecture of lecturesToSelect) {
        if (hasSelectableContent(lecture)) next[lecture.id] = defaultSelectionFor(lecture);
      }
      return next;
    });
  }

  function clearSelection(lecturesToClear: LectureWithCourse[]) {
    setSelections((prev) => {
      const next = { ...prev };
      for (const lecture of lecturesToClear) delete next[lecture.id];
      return next;
    });
  }

  function handleNotesFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setNotesFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  }

  function removeNotesFile(index: number) {
    setNotesFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const selectedCount = Object.keys(selections).length;
  const hasNotes = notesText.trim().length > 0 || notesFiles.length > 0;
  const canGenerate = selectedCount > 0 || hasNotes;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);
    try {
      const guide = await api.createStudyGuide({
        title: title.trim() || undefined,
        focus: focus.trim() || undefined,
        lectures: Object.entries(selections).map(([lecture_id, content]) => ({
          lecture_id,
          ...content,
        })),
        notesText: notesText.trim() || undefined,
        notesFiles: notesFiles.length > 0 ? notesFiles : undefined,
      });
      router.push(`/study-guides/${guide.id}`);
    } catch (err) {
      setError((err as Error).message);
      setGenerating(false);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to create a study guide.
        </p>
      </div>
    );
  }

  const allLectures = lectures ?? [];

  return (
    <div>
      <p>
        <Link href="/study-guides">&larr; Study guides</Link>
      </p>
      <h1>New study guide</h1>
      <p className="muted">
        Select the lectures — and which of their topics, slides, transcript, or notes — to combine into
        one study guide. Add your own notes below to supplement them, or build a guide from notes
        alone.
      </p>
      {error && <p className="error">{error}</p>}

      {lectures === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <form onSubmit={handleGenerate}>
          {allLectures.length > 0 && (
            <div className="actions" style={{ marginBottom: "0.85rem" }}>
              <button type="button" className="secondary" onClick={() => selectAll(allLectures)}>
                Select all lectures
              </button>
              <button type="button" className="secondary" onClick={() => clearSelection(allLectures)}>
                Clear selection
              </button>
            </div>
          )}

          {allLectures.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon" aria-hidden="true">
                🎓
              </span>
              <h3>No lectures yet</h3>
              <p>
                Lectures come from a course&apos;s syllabus schedule (
                <Link href="/upload">upload one</Link>) or can be added by hand on a course&apos;s
                page — or build a guide from your own notes below instead.
              </p>
            </div>
          )}

          {byCourse.map((group) => (
            <div key={group.key} className="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.6rem",
                }}
              >
                <h2 style={{ margin: 0 }}>{group.label}</h2>
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => selectAll(group.lectures)}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => clearSelection(group.lectures)}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <ul className="lecture-picker-list">
                {group.lectures.map((lecture) => {
                  const selection = selections[lecture.id];
                  const hasTopics = Boolean(lecture.topics);
                  const hasSlides = Boolean(lecture.slides_url);
                  const hasTranscript = Boolean(lecture.transcript || lecture.transcript_summary);
                  const hasNotes = Boolean(lecture.notes);
                  const hasAnyContent = hasTopics || hasSlides || hasTranscript || hasNotes;
                  return (
                    <li key={lecture.id} className="lecture-picker-row">
                      <label className="lecture-picker-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(selection)}
                          disabled={!hasAnyContent}
                          onChange={() => toggleLecture(lecture)}
                        />
                        <span>
                          {lecture.week_number ? `Week ${lecture.week_number} — ` : ""}
                          {formatDue({ due_at: lecture.scheduled_at, is_datetime: true }, timeFormat)}
                          {lecture.topics && (
                            <span className="muted"> — {lecture.topics.slice(0, 80)}</span>
                          )}
                          {!hasAnyContent && (
                            <span className="muted"> (no topics, slides, transcript, or notes yet)</span>
                          )}
                        </span>
                      </label>
                      {selection && (
                        <div className="lecture-picker-content-toggles">
                          <label className={hasTopics ? undefined : "disabled"}>
                            <input
                              type="checkbox"
                              checked={selection.include_topics}
                              disabled={!hasTopics}
                              onChange={() => toggleContent(lecture.id, "include_topics")}
                            />{" "}
                            Topics
                          </label>
                          <label className={hasSlides ? undefined : "disabled"}>
                            <input
                              type="checkbox"
                              checked={selection.include_slides}
                              disabled={!hasSlides}
                              onChange={() => toggleContent(lecture.id, "include_slides")}
                            />{" "}
                            Slides
                          </label>
                          <label className={hasTranscript ? undefined : "disabled"}>
                            <input
                              type="checkbox"
                              checked={selection.include_transcript}
                              disabled={!hasTranscript}
                              onChange={() => toggleContent(lecture.id, "include_transcript")}
                            />{" "}
                            Transcript
                          </label>
                          <label className={hasNotes ? undefined : "disabled"}>
                            <input
                              type="checkbox"
                              checked={selection.include_notes}
                              disabled={!hasNotes}
                              onChange={() => toggleContent(lecture.id, "include_notes")}
                            />{" "}
                            Notes
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="card">
            <h2>Your own notes</h2>
            <p className="muted" style={{ marginBottom: "0.6rem" }}>
              Optional — supplements the lecture material above (or stands alone if you don&apos;t
              select any lectures).
            </p>
            <label>
              <strong>Files</strong> (.pdf, .docx, .txt, .md)
              <br />
              <input
                ref={notesFileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                onChange={handleNotesFileChange}
              />
            </label>
            {notesFiles.length > 0 && (
              <ul style={{ marginTop: "0.6rem", listStyle: "none", padding: 0 }}>
                {notesFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      padding: "0.35rem 0",
                    }}
                  >
                    <span>{file.name}</span>
                    <button type="button" className="secondary" onClick={() => removeNotesFile(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label style={{ display: "block", marginTop: "0.85rem" }}>
              <strong>Or paste text</strong>
              <br />
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={5}
                style={{ width: "100%", marginTop: "0.3rem" }}
                placeholder="Paste your own notes here…"
              />
            </label>
          </div>

          <div className="card">
            <h2>Details</h2>
            <p>
              <label style={{ display: "block" }}>
                Title <span className="muted">(optional — auto-generated if left blank)</span>
                <br />
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Midterm 1 review"
                  style={{ width: "100%", marginTop: "0.3rem" }}
                />
              </label>
            </p>
            <p>
              <label style={{ display: "block" }}>
                Focus <span className="muted">(optional — what to emphasize)</span>
                <br />
                <textarea
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  rows={2}
                  style={{ width: "100%", marginTop: "0.3rem" }}
                  placeholder="e.g. focus on definitions and anything called out as exam-relevant"
                />
              </label>
            </p>
            <button type="submit" disabled={generating || !canGenerate}>
              {generating
                ? "Generating…"
                : `Generate study guide${selectedCount > 0 ? ` (${selectedCount} lecture${selectedCount === 1 ? "" : "s"})` : ""}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
