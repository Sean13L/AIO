import type { Pool, PoolClient } from "pg";

export interface Course {
  id: string;
  user_id: string;
  course_code: string;
  course_name: string;
  semester: string | null;
  created_at: string;
}

export interface CourseInput {
  course_code: string;
  course_name: string;
  semester: string | null;
}

export async function listCoursesByUser(
  db: Pool | PoolClient,
  userId: string
): Promise<Course[]> {
  const result = await db.query<Course>(
    "SELECT * FROM courses WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return result.rows;
}

export async function getCourseForUser(
  db: Pool | PoolClient,
  userId: string,
  courseId: string
): Promise<Course | null> {
  const result = await db.query<Course>(
    "SELECT * FROM courses WHERE id = $1 AND user_id = $2",
    [courseId, userId]
  );
  return result.rows[0] ?? null;
}

export async function createCourse(
  db: Pool | PoolClient,
  userId: string,
  input: CourseInput
): Promise<Course> {
  const result = await db.query<Course>(
    `INSERT INTO courses (user_id, course_code, course_name, semester)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, input.course_code, input.course_name, input.semester]
  );
  return result.rows[0];
}

export async function findOrCreateCourse(
  db: Pool | PoolClient,
  userId: string,
  input: CourseInput
): Promise<Course> {
  const existing = await db.query<Course>(
    `SELECT * FROM courses
     WHERE user_id = $1 AND course_code = $2 AND semester IS NOT DISTINCT FROM $3`,
    [userId, input.course_code, input.semester]
  );
  if (existing.rows[0]) return existing.rows[0];
  return createCourse(db, userId, input);
}

export async function deleteCourseForUser(
  db: Pool | PoolClient,
  userId: string,
  courseId: string
): Promise<boolean> {
  const result = await db.query(
    "DELETE FROM courses WHERE id = $1 AND user_id = $2",
    [courseId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
