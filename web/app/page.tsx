"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";
import { LogoMark } from "@/components/Logo";
import { courseAccentKey, courseInitials } from "@/lib/uiColors";

export default function CoursesPage() {
  const { email, ready } = useAuthGate();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [semester, setSemester] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setCourses(await api.listCourses());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !courseCode.trim() || !courseName.trim()) return;
    setSubmitting(true);
    try {
      await api.createCourse({
        course_code: courseCode.trim(),
        course_name: courseName.trim(),
        semester: semester.trim() || null,
      });
      setCourseCode("");
      setCourseName("");
      setSemester("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(courseId: string) {
    if (!email) return;
    if (!confirm("Delete this course and everything in it (items, lectures, syllabi)?")) return;
    try {
      await api.deleteCourse(courseId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;

  if (!email) {
    return (
      <div>
        <div className="home-hero full-bleed">
          <div className="home-hero-glow" aria-hidden="true" />
          <span className="eyebrow">AI-Powered Syllabus Intelligence</span>
          <h1>
            Turn your syllabus into a{" "}
            <span className="gradient-text">semester you can actually plan around</span>
          </h1>
          <p className="lede">
            Upload a course syllabus and Studdy reads it with AI, then builds a live calendar,
            deadline tracker, and lecture pre-review for every course — automatically.
          </p>
          <div className="actions">
            <Link href="/auth/signin">
              <button type="button">Sign in to get started →</button>
            </Link>
            <a href="#how-it-works">
              <button type="button" className="ghost">
                See how it works
              </button>
            </a>
          </div>

          <div className="mock-card">
            <div className="mock-card-header">
              <span className="mock-badge">CS135 — This week</span>
              <LogoMark size={22} />
            </div>
            <div className="mock-row">
              <span className="mock-dot" style={{ background: "#7c9bff" }} />
              <div>
                <div className="mock-row-title">Problem Set 3</div>
                <div className="mock-row-sub">Due Thu, Oct 8 at 11:59 PM</div>
              </div>
              <span className="mock-tag" style={{ background: "rgba(124,138,255,0.15)", color: "#a9b6ff" }}>
                Assignment
              </span>
            </div>
            <div className="mock-row">
              <span className="mock-dot" style={{ background: "#c7a6ff" }} />
              <div>
                <div className="mock-row-title">Lecture 12 — Recursion</div>
                <div className="mock-row-sub">Tue &amp; Thu, 1:30 PM · Pre-review ready</div>
              </div>
              <span className="mock-tag" style={{ background: "rgba(199,166,255,0.15)", color: "#dcc9ff" }}>
                Lecture
              </span>
            </div>
            <div className="mock-row">
              <span className="mock-dot" style={{ background: "#f5b567" }} />
              <div>
                <div className="mock-row-title">Midterm Exam</div>
                <div className="mock-row-sub">Mon, Oct 20 at 2:00 PM</div>
              </div>
              <span className="mock-tag" style={{ background: "rgba(245,181,103,0.15)", color: "#f5c98c" }}>
                Midterm
              </span>
            </div>
          </div>
        </div>

        <div id="how-it-works" className="section-head" style={{ marginTop: "3.5rem" }}>
          <span className="eyebrow">Get Started In</span>
          <h2>Four simple steps</h2>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <div>
              <h3>Upload your syllabus</h3>
              <p>A PDF, a DOCX, or just pasted text — however you have it.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div>
              <h3>AI extracts every deadline</h3>
              <p>Grading weights, policies, assignments, exams, and the full lecture schedule.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div>
              <h3>Your calendar builds itself</h3>
              <p>Every date organized automatically — no manual entry, nothing to miss.</p>
            </div>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <div>
              <h3>Stay ahead all semester</h3>
              <p>Pre-lecture briefs, a kanban board, and a running to-do list, all in sync.</p>
            </div>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: "3.5rem" }}>
          <span className="eyebrow">Everything A Syllabus PDF Buries</span>
          <h2>Surfaced, automatically</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card feature-card-blue">
            <span className="feature-icon-circle" aria-hidden="true">
              📄
            </span>
            <h3>AI syllabus extraction</h3>
            <p>
              Grading weights, policies, and every deadline — pulled from a PDF, DOCX, or pasted
              text into structured data, not a wall of notes.
            </p>
          </div>
          <div className="feature-card feature-card-violet">
            <span className="feature-icon-circle" aria-hidden="true">
              🗓️
            </span>
            <h3>A calendar that just works</h3>
            <p>
              Every deadline and lecture in one view, with a subscribable feed for Google,
              Outlook, or Apple Calendar — or instant push straight to your own Google Calendar.
            </p>
          </div>
          <div className="feature-card feature-card-teal">
            <span className="feature-icon-circle" aria-hidden="true">
              🎓
            </span>
            <h3>Pre-lecture previews</h3>
            <p>
              Upload this week&apos;s slides and get a primer that cross-references them against
              the syllabus schedule, generated automatically before class.
            </p>
          </div>
          <div className="feature-card feature-card-amber">
            <span className="feature-icon-circle" aria-hidden="true">
              ✅
            </span>
            <h3>Timeline, board, and to-dos</h3>
            <p>
              The same deadlines shown as a kanban board, a month-by-month timeline, or a running
              task list — whichever view fits how you work.
            </p>
          </div>
        </div>

        <div className="home-cta full-bleed" style={{ marginTop: "3.5rem" }}>
          <div className="home-cta-glow" aria-hidden="true" />
          <div className="home-cta-inner">
            <h2>Stop losing track of deadlines</h2>
            <p>Free to use — sign in with email or Google and upload your first syllabus in under a minute.</p>
            <Link href="/auth/signin">
              <button type="button">Sign in with email or Google</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Courses</h1>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Add a course</h2>
        <form className="inline" onSubmit={handleCreate}>
          <label>
            Course code
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="CS135"
              required
            />
          </label>
          <label>
            Course name
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Designing Functional Programs"
              required
            />
          </label>
          <label>
            Semester
            <input
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="1A"
            />
          </label>
          <button type="submit" disabled={submitting}>
            Add course
          </button>
        </form>
      </div>

      {courses === null ? (
        <p className="muted">Loading…</p>
      ) : courses.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            🗂️
          </span>
          <h3>No courses yet</h3>
          <p>Add one above, or upload a syllabus and let Studdy fill this in for you.</p>
          <div className="actions">
            <Link href="/upload">
              <button type="button">Upload a syllabus</button>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="course-list">
          {courses.map((course) => (
            <li key={course.id} className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                <span
                  className={`course-avatar avatar-${courseAccentKey(course.course_code)}`}
                  aria-hidden="true"
                >
                  {courseInitials(course.course_code)}
                </span>
                <div>
                  <Link href={`/courses/${course.id}`}>
                    <strong>{course.course_code}</strong> — {course.course_name}
                  </Link>
                  {course.semester && <span className="badge">{course.semester}</span>}
                </div>
              </div>
              <button className="danger" onClick={() => handleDelete(course.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
