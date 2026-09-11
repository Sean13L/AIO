import { pool } from "../db/client.js";
import { findOrCreateUserByEmail } from "../db/repositories/users.js";
import { findOrCreateCourse } from "../db/repositories/courses.js";
import { createItem } from "../db/repositories/items.js";
import { createLecture } from "../db/repositories/lectures.js";
import { extractRawText, type SyllabusInput } from "../extraction/parseFile.js";
import { extractSyllabus } from "../extraction/extractSyllabus.js";
import type { SyllabusExtraction } from "../extraction/schema.js";
import { toTimestamp } from "../util/timestamp.js";

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

export async function ingestSyllabus(
  params: IngestSyllabusParams
): Promise<IngestSyllabusResult> {
  const rawText = await extractRawText(params.input);
  const extraction = await extractSyllabus({ syllabusText: rawText });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await findOrCreateUserByEmail(client, params.userEmail);
    const course = await findOrCreateCourse(client, user.id, extraction.course);

    const syllabusInsert = await client.query<{ id: string }>(
      `INSERT INTO syllabi (course_id, file_url, raw_extraction)
       VALUES ($1, $2, $3) RETURNING id`,
      [course.id, params.fileUrl, JSON.stringify(extraction)]
    );
    const syllabusId = syllabusInsert.rows[0].id;

    for (const item of extraction.items) {
      await createItem(
        client,
        course.id,
        {
          name: item.name,
          type: item.type,
          due_at: toTimestamp(item.due_date, item.due_time),
          is_datetime: item.is_datetime,
          weight: item.weight,
          notes: item.notes,
        },
        "extracted"
      );
    }
    for (const lecture of extraction.lectures) {
      await createLecture(client, course.id, {
        scheduled_at: toTimestamp(lecture.scheduled_date, lecture.scheduled_time),
        week_number: lecture.week_number,
        topics: lecture.topics,
      });
    }

    await client.query("COMMIT");

    return {
      userId: user.id,
      courseId: course.id,
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
