"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { StudyGuideDetail } from "@/lib/types";
import { formatDue } from "@/lib/dates";
import { useTimeFormatPreference } from "@/lib/timeFormat";
import { FlashcardViewer } from "@/components/FlashcardViewer";
import { QuizViewer } from "@/components/QuizViewer";

function MockWarning({ children }: { children: React.ReactNode }) {
  return (
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
      ⚠ {children}
    </p>
  );
}

export default function StudyGuideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { email, ready } = useAuthGate();
  const router = useRouter();
  const timeFormat = useTimeFormatPreference();
  const [guide, setGuide] = useState<StudyGuideDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusDraft, setFocusDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);

  useEffect(() => {
    if (!email) return;
    api
      .getStudyGuide(id)
      .then((g) => {
        setGuide(g);
        setFocusDraft(g.focus ?? "");
      })
      .catch((err) => setError((err as Error).message));
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

  async function handleRegenerate() {
    if (!email) return;
    setRegenerating(true);
    setError(null);
    try {
      setGuide(await api.regenerateStudyGuide(id, { focus: focusDraft }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleGenerateFlashcards() {
    if (!email) return;
    setGeneratingFlashcards(true);
    setError(null);
    try {
      const { cards, used_mock } = await api.generateFlashcards(id);
      setGuide((g) => (g ? { ...g, flashcards: cards, flashcards_used_mock: used_mock } : g));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingFlashcards(false);
    }
  }

  async function handleGenerateQuiz() {
    if (!email) return;
    setGeneratingQuiz(true);
    setError(null);
    try {
      const { questions, used_mock } = await api.generateQuiz(id);
      setGuide((g) => (g ? { ...g, quiz: questions, quiz_used_mock: used_mock } : g));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingQuiz(false);
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
  if (error && !guide) return <p className="error">{error}</p>;
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
        <MockWarning>
          No AI key is configured, so this used a basic offline generator instead of real AI —
          it&apos;s just excerpts of the source material, not an actual study guide.
        </MockWarning>
      )}

      <div className="card">
        <p style={{ whiteSpace: "pre-wrap" }}>{guide.content}</p>
      </div>

      <div className="card">
        <h2>Regenerate</h2>
        <p className="muted" style={{ marginBottom: "0.6rem" }}>
          Rebuilds this guide from the same lectures/content below — picks up anything that&apos;s
          changed since (new slides, an edited transcript). Optionally adjust the focus first.
        </p>
        <textarea
          value={focusDraft}
          onChange={(e) => setFocusDraft(e.target.value)}
          rows={2}
          style={{ width: "100%", marginBottom: "0.75rem" }}
          placeholder="e.g. focus on definitions and anything called out as exam-relevant"
        />
        <button type="button" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate study guide"}
        </button>
      </div>

      <div className="card">
        <h2>Flashcards</h2>
        {guide.flashcards_used_mock && guide.flashcards && (
          <MockWarning>
            No AI key is configured, so these are placeholder cards, not real flashcards.
          </MockWarning>
        )}
        {guide.flashcards && guide.flashcards.length > 0 ? (
          <FlashcardViewer cards={guide.flashcards} />
        ) : (
          <p className="muted">No flashcards yet — generate a set from this guide&apos;s content.</p>
        )}
        <button
          type="button"
          onClick={handleGenerateFlashcards}
          disabled={generatingFlashcards}
          style={{ marginTop: "0.85rem" }}
        >
          {generatingFlashcards
            ? "Generating…"
            : guide.flashcards
              ? "Regenerate flashcards"
              : "Generate flashcards"}
        </button>
      </div>

      <div className="card">
        <h2>Quiz</h2>
        {guide.quiz_used_mock && guide.quiz && (
          <MockWarning>
            No AI key is configured, so this is a placeholder question, not a real quiz.
          </MockWarning>
        )}
        {guide.quiz && guide.quiz.length > 0 ? (
          <QuizViewer questions={guide.quiz} />
        ) : (
          <p className="muted">No quiz yet — generate one from this guide&apos;s content.</p>
        )}
        <button
          type="button"
          onClick={handleGenerateQuiz}
          disabled={generatingQuiz}
          style={{ marginTop: "0.85rem" }}
        >
          {generatingQuiz ? "Generating…" : guide.quiz ? "Regenerate quiz" : "Generate quiz"}
        </button>
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
