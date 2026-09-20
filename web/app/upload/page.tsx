"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";

interface UploadResult {
  courseId: string;
  itemsCreated: number;
  lecturesCreated: number;
  usedMock: boolean;
}

function UploadForm() {
  const { email, ready } = useAuthGate();
  const searchParams = useSearchParams();
  // Pre-selects the course a "+ Add syllabus" link on a course page was
  // clicked from, so uploading a syllabus for an existing course doesn't
  // require re-picking it from the dropdown (and doesn't risk landing on
  // a new auto-matched course instead, if the extracted course_code/semester
  // don't happen to match this one exactly).
  const preselectedCourseId = searchParams.get("course_id") ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [courseId, setCourseId] = useState(preselectedCourseId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    if (!email) return;
    api.listCourses().then(setCourses).catch((err) => setError((err as Error).message));
  }, [email]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    // Additive: picking more files adds to the list rather than replacing
    // it, so choosing the main syllabus and a supplemental doc in two
    // separate picks both end up attached.
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 && !pastedText.trim()) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.uploadSyllabus({
        files: files.length > 0 ? files : undefined,
        text: pastedText.trim() || undefined,
        courseId: courseId || undefined,
      });
      setResult(res);
      setPastedText("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const preselectedCourse = courses?.find((c) => c.id === preselectedCourseId);

  return (
    <div>
      <h1>Upload a syllabus</h1>
      <p className="muted">
        Upload a PDF, DOCX, or plain-text syllabus (or paste its text below) and it&apos;ll be
        extracted into a course, its deadlines, and its lecture schedule automatically. Add more
        files if there&apos;s supplemental info the syllabus itself doesn&apos;t cover — a separate
        exam schedule, a lab-policy addendum — and they&apos;ll all be read together.
      </p>
      {preselectedCourseId && (
        <p className="muted">
          Adding to{" "}
          <strong style={{ color: "var(--color-text)" }}>
            {preselectedCourse
              ? `${preselectedCourse.course_code} — ${preselectedCourse.course_name}`
              : "the selected course"}
          </strong>
          .
        </p>
      )}
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
              <strong>Files</strong> (.pdf, .docx, .txt, .md — pick multiple, or add more in
              another pick)
              <br />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                onChange={handleFileChange}
              />
            </label>
            {files.length > 0 && (
              <ul style={{ marginTop: "0.6rem", listStyle: "none", padding: 0 }}>
                {files.map((file, i) => (
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
                    <button type="button" className="secondary" onClick={() => removeFile(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </p>
          <p className="muted">— and/or —</p>
          <p>
            <label style={{ display: "block" }}>
              <strong>Paste text</strong> (main syllabus, or supplemental notes)
              <br />
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                style={{ width: "100%", marginTop: "0.4rem" }}
                placeholder="Paste syllabus or supplemental text here…"
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

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadForm />
    </Suspense>
  );
}
