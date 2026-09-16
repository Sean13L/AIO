"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";

interface UploadResult {
  courseId: string;
  itemsCreated: number;
  lecturesCreated: number;
}

export default function UploadPage() {
  const { email, ready } = useAuthGate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file && !pastedText.trim()) return;

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = file
        ? await api.uploadSyllabus({ file })
        : await api.uploadSyllabus({ text: pastedText });
      setResult(res);
      setPastedText("");
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
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" />
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
          <button type="submit" disabled={submitting}>
            {submitting ? "Extracting…" : "Upload and extract"}
          </button>
        </form>
      </div>
    </div>
  );
}
