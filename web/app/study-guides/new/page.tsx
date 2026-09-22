"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
      if (next[lecture.id]) {
        delete next[lecture.id];
      } else {
        // Only offer/default-check content types this lecture actually has.
        next[lecture.id] = {
          include_topics: Boolean(lecture.topics),
          include_slides: Boolean(lecture.slides_url),
          include_transcript: Boolean(lecture.transcript || lecture.transcript_summary),
        };
      }
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

  const selectedCount = Object.keys(selections).length;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCount === 0) return;
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

  return (
    <div>
      <p>
        <Link href="/study-guides">&larr; Study guides</Link>
      </p>
      <h1>New study guide</h1>
      <p className="muted">
        Select the lectures — and which of their topics, slides, or transcript — to combine into
        one study guide.
      </p>
      {error && <p className="error">{error}</p>}

      {lectures === null ? (
        <p className="muted">Loading…</p>
      ) : lectures.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            🎓
          </span>
          <h3>No lectures yet</h3>
          <p>
            Lectures come from a course&apos;s syllabus schedule. <Link href="/upload">Upload one</Link>{" "}
            first.
          </p>
        </div>
      ) : (
        <form onSubmit={handleGenerate}>
          {byCourse.map((group) => (
            <div key={group.key} className="card">
              <h2>{group.label}</h2>
              <ul className="lecture-picker-list">
                {group.lectures.map((lecture) => {
                  const selection = selections[lecture.id];
                  const hasTopics = Boolean(lecture.topics);
                  const hasSlides = Boolean(lecture.slides_url);
                  const hasTranscript = Boolean(lecture.transcript || lecture.transcript_summary);
                  const hasAnyContent = hasTopics || hasSlides || hasTranscript;
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
                            <span className="muted"> (no topics, slides, or transcript yet)</span>
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
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

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
            <button type="submit" disabled={generating || selectedCount === 0}>
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
