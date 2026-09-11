"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api } from "@/lib/api";
import type { Course } from "@/lib/types";

export default function CoursesPage() {
  const { email, ready } = useCurrentUser();
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
      setCourses(await api.listCourses(email));
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
      await api.createCourse(email, {
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
      await api.deleteCourse(email, courseId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;

  if (!email) {
    return (
      <div className="card">
        <p>Enter your email above to see your courses.</p>
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
        <p className="muted">
          No courses yet. Add one above, or run <code>npm run ingest</code> in{" "}
          <code>server/</code> to import a syllabus.
        </p>
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
