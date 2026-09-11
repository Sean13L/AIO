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
