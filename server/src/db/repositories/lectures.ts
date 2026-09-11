import type { Pool, PoolClient } from "pg";

export type PreviewStatus = "not_generated" | "generated" | "viewed";

export interface Lecture {
  id: string;
  course_id: string;
  scheduled_at: string;
  week_number: number | null;
  topics: string | null;
  slides_url: string | null;
  preview_status: PreviewStatus;
  preview_content: string | null;
  created_at: string;
}

export interface LectureInput {
  scheduled_at: string; // ISO timestamp
  week_number: number | null;
  topics: string | null;
}

export async function listLecturesByCourse(
  db: Pool | PoolClient,
  courseId: string
): Promise<Lecture[]> {
  const result = await db.query<Lecture>(
    "SELECT * FROM lectures WHERE course_id = $1 ORDER BY scheduled_at",
    [courseId]
  );
  return result.rows;
}

export interface LectureWithCourse extends Lecture {
  course_code: string;
  course_name: string;
}

// For the calendar feed: lectures need their course code/name for the event
// summary without a second round trip per course.
export async function listLecturesWithCourseForUser(
  db: Pool | PoolClient,
  userId: string
): Promise<LectureWithCourse[]> {
  const result = await db.query<LectureWithCourse>(
    `SELECT lectures.*, courses.course_code, courses.course_name
     FROM lectures
     JOIN courses ON courses.id = lectures.course_id
     WHERE courses.user_id = $1
     ORDER BY lectures.scheduled_at`,
    [userId]
  );
  return result.rows;
}

export async function createLecture(
  db: Pool | PoolClient,
  courseId: string,
  input: LectureInput
): Promise<Lecture> {
  const result = await db.query<Lecture>(
    `INSERT INTO lectures (course_id, scheduled_at, week_number, topics)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [courseId, input.scheduled_at, input.week_number, input.topics]
  );
  return result.rows[0];
}

export async function getLectureForUser(
  db: Pool | PoolClient,
  userId: string,
  lectureId: string
): Promise<Lecture | null> {
  const result = await db.query<Lecture>(
    `SELECT lectures.* FROM lectures
     JOIN courses ON courses.id = lectures.course_id
     WHERE lectures.id = $1 AND courses.user_id = $2`,
    [lectureId, userId]
  );
  return result.rows[0] ?? null;
}

export async function setLectureSlidesUrl(
  db: Pool | PoolClient,
  lectureId: string,
  slidesUrl: string
): Promise<Lecture> {
  const result = await db.query<Lecture>(
    "UPDATE lectures SET slides_url = $2 WHERE id = $1 RETURNING *",
    [lectureId, slidesUrl]
  );
  return result.rows[0];
}

export async function setLecturePreview(
  db: Pool | PoolClient,
  lectureId: string,
  previewContent: string
): Promise<Lecture> {
  const result = await db.query<Lecture>(
    `UPDATE lectures SET preview_content = $2, preview_status = 'generated'
     WHERE id = $1 RETURNING *`,
    [lectureId, previewContent]
  );
  return result.rows[0];
}

// Marks a preview "viewed" the first time the student actually opens the
// lecture page — only transitions out of 'generated', never overwrites
// 'not_generated' or a later re-view.
export async function markLecturePreviewViewed(
  db: Pool | PoolClient,
  lectureId: string
): Promise<void> {
  await db.query(
    "UPDATE lectures SET preview_status = 'viewed' WHERE id = $1 AND preview_status = 'generated'",
    [lectureId]
  );
}

export interface LectureNeedingPreview extends Lecture {
  course_code: string;
}

// Global sweep (not scoped to one user) for the scheduled preview-generation
// job — see server/src/scheduler.ts.
export async function listLecturesNeedingPreview(
  db: Pool | PoolClient,
  leadHours: number
): Promise<LectureNeedingPreview[]> {
  const result = await db.query<LectureNeedingPreview>(
    `SELECT lectures.*, courses.course_code
     FROM lectures
     JOIN courses ON courses.id = lectures.course_id
     WHERE lectures.preview_status = 'not_generated'
       AND lectures.scheduled_at BETWEEN now() AND now() + ($1 * interval '1 hour')`,
    [leadHours]
  );
  return result.rows;
}
