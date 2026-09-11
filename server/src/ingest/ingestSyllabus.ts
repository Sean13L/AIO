import type { PoolClient } from "pg";
import { pool } from "../db/client.js";
import { extractRawText, type SyllabusInput } from "../extraction/parseFile.js";
import { extractSyllabus } from "../extraction/extractSyllabus.js";
import type {
  SyllabusExtraction,
  ExtractedItem,
  ExtractedLecture,
} from "../extraction/schema.js";

export interface IngestSyllabusParams {
  userEmail: string;
  fileUrl: string; // local path, storage key, or "pasted-text:<timestamp>" — traceability only
  input: SyllabusInput;
}

export interface IngestSyllabusResult {
  userId: string;
  courseId: string;
  syllabusId: string;
  itemsCreated: number;
  lecturesCreated: number;
  extraction: SyllabusExtraction;
}

// The schema has no per-user timezone concept yet, so naive syllabus
// date/time strings are treated as UTC. Revisit once timezones are modeled.
function toTimestamp(date: string, time: string | null): string {
  return `${date}T${time ?? "00:00"}:00Z`;
}

async function findOrCreateUser(
  client: PoolClient,
  email: string
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await client.query<{ id: string }>(
    "INSERT INTO users (email) VALUES ($1) RETURNING id",
    [email]
  );
  return inserted.rows[0].id;
}

async function findOrCreateCourse(
  client: PoolClient,
  userId: string,
  course: SyllabusExtraction["course"]
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM courses
     WHERE user_id = $1 AND course_code = $2 AND semester IS NOT DISTINCT FROM $3`,
    [userId, course.course_code, course.semester]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO courses (user_id, course_code, course_name, semester)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, course.course_code, course.course_name, course.semester]
  );
  return inserted.rows[0].id;
}

async function insertItem(
  client: PoolClient,
  courseId: string,
  item: ExtractedItem
): Promise<void> {
  await client.query(
    `INSERT INTO items (course_id, name, type, due_at, is_datetime, weight, notes, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'extracted')`,
    [
      courseId,
      item.name,
      item.type,
      toTimestamp(item.due_date, item.due_time),
      item.is_datetime,
      item.weight,
      item.notes,
    ]
  );
}

async function insertLecture(
  client: PoolClient,
  courseId: string,
  lecture: ExtractedLecture
): Promise<void> {
  await client.query(
    `INSERT INTO lectures (course_id, scheduled_at, week_number, topics)
     VALUES ($1, $2, $3, $4)`,
    [
      courseId,
      toTimestamp(lecture.scheduled_date, lecture.scheduled_time),
      lecture.week_number,
      lecture.topics,
    ]
  );
}

export async function ingestSyllabus(
  params: IngestSyllabusParams
): Promise<IngestSyllabusResult> {
  const rawText = await extractRawText(params.input);
  const extraction = await extractSyllabus({ syllabusText: rawText });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = await findOrCreateUser(client, params.userEmail);
    const courseId = await findOrCreateCourse(client, userId, extraction.course);

    const syllabusInsert = await client.query<{ id: string }>(
      `INSERT INTO syllabi (course_id, file_url, raw_extraction)
       VALUES ($1, $2, $3) RETURNING id`,
      [courseId, params.fileUrl, JSON.stringify(extraction)]
    );
    const syllabusId = syllabusInsert.rows[0].id;

    for (const item of extraction.items) {
      await insertItem(client, courseId, item);
    }
    for (const lecture of extraction.lectures) {
      await insertLecture(client, courseId, lecture);
    }

    await client.query("COMMIT");

    return {
      userId,
      courseId,
      syllabusId,
      itemsCreated: extraction.items.length,
      lecturesCreated: extraction.lectures.length,
      extraction,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
