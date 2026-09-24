import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { extractCombinedRawText, type SyllabusInput } from "./extraction/parseFile";
import { extractSyllabus } from "./extraction/extractSyllabus";
import type { SyllabusExtraction } from "./extraction/schema";
import { toTimestamp } from "./timestamp";
import { syncUserCalendarToGoogle } from "./calendar/googleCalendar";

export interface IngestSyllabusParams {
  userId: string;
  fileUrl: string; // local path(s) or "pasted-text:<timestamp>" — traceability only, joined with ", " when multiple documents were uploaded together
  inputs: SyllabusInput[]; // the syllabus plus any supplemental documents uploaded alongside it
  // When set, the syllabus is attached to this existing course instead of
  // auto-matching/creating one by extracted course_code+semester. Caller
  // (the API route) is responsible for verifying it belongs to userId
  // before calling in — this trusts that check rather than repeating it,
  // since it already needs the row inside the transaction either way.
  courseId?: string;
}

export interface IngestSyllabusResult {
  courseId: string;
  syllabusId: string;
  itemsCreated: number;
  lecturesCreated: number;
  extraction: SyllabusExtraction;
  usedMock: boolean;
}

export async function ingestSyllabus({
  userId,
  fileUrl,
  inputs,
  courseId,
}: IngestSyllabusParams): Promise<IngestSyllabusResult> {
  const rawText = await extractCombinedRawText(inputs);
  const { extraction, usedMock } = await extractSyllabus({ syllabusText: rawText, userId });

  const result = await prisma.$transaction(async (tx) => {
    let course;
    if (courseId) {
      // Attach to the course the user explicitly picked — don't rename it
      // to whatever the syllabus's own header says, and don't fall back to
      // auto-matching if it's somehow gone (caller already validated
      // ownership; a 404 here means it was deleted mid-request).
      course = await tx.courses.findFirstOrThrow({ where: { id: courseId, user_id: userId } });
    } else {
      const existingCourse = await tx.courses.findFirst({
        where: {
          user_id: userId,
          course_code: extraction.course.course_code,
          semester: extraction.course.semester,
        },
      });
      course =
        existingCourse ??
        (await tx.courses.create({
          data: {
            user_id: userId,
            course_code: extraction.course.course_code,
            course_name: extraction.course.course_name,
            semester: extraction.course.semester,
          },
        }));
    }

    const syllabus = await tx.syllabi.create({
      data: {
        course_id: course.id,
        file_url: fileUrl,
        raw_extraction: extraction as unknown as Prisma.InputJsonValue,
      },
    });

    for (const item of extraction.items) {
      await tx.items.create({
        data: {
          course_id: course.id,
          name: item.name,
          type: item.type,
          due_at: toTimestamp(item.due_date, item.due_time),
          is_datetime: item.is_datetime,
          weight: item.weight,
          notes: item.notes,
          source: "extracted",
        },
      });
    }

    for (const lecture of extraction.lectures) {
      await tx.lectures.create({
        data: {
          course_id: course.id,
          scheduled_at: toTimestamp(lecture.scheduled_date, lecture.scheduled_time),
          week_number: lecture.week_number,
          topics: lecture.topics,
        },
      });
    }

    return {
      courseId: course.id,
      syllabusId: syllabus.id,
      itemsCreated: extraction.items.length,
      lecturesCreated: extraction.lectures.length,
      extraction,
      usedMock,
    };
  });

  // Outside the transaction (it's a network call, not a DB write) and
  // best-effort — see googleCalendar.ts.
  await syncUserCalendarToGoogle(userId);
  return result;
}
