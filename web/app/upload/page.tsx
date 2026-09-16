"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";

interface UploadResult {
  courseId: string;
  itemsCreated: number;
  lecturesCreated: number;
  usedMock: boolean;
}

export default function UploadPage() {
  const { email, ready } = useAuthGate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    if (!email) return;
    api.listCourses().then(setCourses).catch((err) => setError((err as Error).message));
  }, [email]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
  }

  function clearFile() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileName(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file && !pastedText.trim()) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = file
        ? await api.uploadSyllabus({ file, courseId: courseId || undefined })
        : await api.uploadSyllabus({ text: pastedText, courseId: courseId || undefined });
      setResult(res);
      setPastedText("");
      clearFile();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to upload a syllabus.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Upload a syllabus</h1>
      <p className="muted">
        Upload a PDF, DOCX, or plain-text syllabus (or paste its text below) and it&apos;ll be
        extracted into a course, its deadlines, and its lecture schedule automatically.
      </p>
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card" style={{ borderColor: "var(--color-success)" }}>
          <p className="success" style={{ marginBottom: "0.75rem" }}>
            ✓ Imported {result.itemsCreated} item{result.itemsCreated === 1 ? "" : "s"} and{" "}
            {result.lecturesCreated} lecture{result.lecturesCreated === 1 ? "" : "s"}.
          </p>
          {result.usedMock && (
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
              ⚠ No AI extraction key is configured, so this used a basic offline parser instead
              of real AI extraction — it only picks up a narrow set of formats and may have
              produced inaccurate or missing items. Check the course page and edit anything
              that&apos;s wrong.
            </p>
          )}
          <Link href={`/courses/${result.courseId}`}>
            <button type="button">View course</button>
          </Link>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <p>
            <label>
              <strong>File</strong> (.pdf, .docx, .txt, .md)
              <br />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                style={{ display: fileName ? "none" : "inline-block" }}
              />
              {fileName && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    marginTop: "0.3rem",
                  }}
                >
                  <span>{fileName}</span>
                  <button type="button" className="secondary" onClick={clearFile}>
                    Remove file
                  </button>
                </span>
              )}
            </label>
          </p>
          <p className="muted">— or —</p>
          <p>
            <label style={{ display: "block" }}>
              <strong>Paste syllabus text</strong>
              <br />
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                style={{ width: "100%", marginTop: "0.4rem" }}
                placeholder="Paste the full syllabus text here…"
              />
            </label>
          </p>
          <p>
            <label>
              <strong>Add to</strong>
              <br />
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                style={{ marginTop: "0.3rem" }}
              >
                <option value="">Detect automatically (new or matching course)</option>
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name}
                    {c.semester ? ` (${c.semester})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <button type="submit" disabled={submitting}>
            {submitting ? "Extracting…" : "Upload and extract"}
          </button>
        </form>
      </div>
    </div>
  );
}
