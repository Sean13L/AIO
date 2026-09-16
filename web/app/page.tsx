"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";
import { CalendarFeedCard } from "@/components/CalendarFeedCard";
import { LogoMark } from "@/components/Logo";

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
        <div className="home-hero">
          <LogoMark size={56} />
          <h1>Your syllabus, turned into a semester you can actually plan around</h1>
          <p className="lede">
            Upload a course syllabus and Studently reads it with AI, then builds a live calendar,
            deadline tracker, and lecture pre-review for every course — automatically.
          </p>
          <div className="actions">
            <Link href="/auth/signin">
              <button type="button">Sign in to get started</button>
            </Link>
          </div>
        </div>

        <h2 className="home-section-title">Everything a syllabus PDF buries, surfaced</h2>
        <p className="muted home-section-subtitle">
          One upload extracts what matters — no manual data entry.
        </p>
        <div className="feature-grid">
          <div className="feature-card feature-card-blue">
            <span className="feature-icon" aria-hidden="true">
              📄
            </span>
            <h3>AI syllabus extraction</h3>
            <p>
              Grading weights, policies, and every deadline — pulled from a PDF, DOCX, or pasted
              text into structured data, not a wall of notes.
            </p>
          </div>
          <div className="feature-card feature-card-violet">
            <span className="feature-icon" aria-hidden="true">
              🗓️
            </span>
            <h3>A calendar that just works</h3>
            <p>
              Every deadline and lecture in one view, with a subscribable feed for Google,
              Outlook, or Apple Calendar — or instant push straight to your own Google Calendar.
            </p>
          </div>
          <div className="feature-card feature-card-teal">
            <span className="feature-icon" aria-hidden="true">
              🎓
            </span>
            <h3>Pre-lecture previews</h3>
            <p>
              Upload this week&apos;s slides and get a primer that cross-references them against
              the syllabus schedule, generated automatically before class.
            </p>
          </div>
          <div className="feature-card feature-card-amber">
            <span className="feature-icon" aria-hidden="true">
              ✅
            </span>
            <h3>Timeline, board, and to-dos</h3>
            <p>
              The same deadlines shown as a kanban board, a month-by-month timeline, or a running
              task list — whichever view fits how you work.
            </p>
          </div>
        </div>

        <div className="home-hero" style={{ paddingTop: "1rem", paddingBottom: "2rem" }}>
          <Link href="/auth/signin">
            <button type="button">Sign in with email or Google</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Courses</h1>
      {error && <p className="error">{error}</p>}

      <Suspense fallback={null}>
        <CalendarFeedCard />
      </Suspense>

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
          <p>Add one above, or upload a syllabus and let Studently fill this in for you.</p>
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
              <div>
                <Link href={`/courses/${course.id}`}>
                  <strong>{course.course_code}</strong> — {course.course_name}
                </Link>
                {course.semester && <span className="badge">{course.semester}</span>}
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
