import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { extractRawText, type SyllabusInput } from "./extraction/parseFile";
import { extractSyllabus } from "./extraction/extractSyllabus";
import type { SyllabusExtraction } from "./extraction/schema";
import { toTimestamp } from "./timestamp";

export interface IngestSyllabusParams {
  userId: string;
  fileUrl: string; // local path or "pasted-text:<timestamp>" — traceability only
  input: SyllabusInput;
}

export interface IngestSyllabusResult {
  courseId: string;
  syllabusId: string;
  itemsCreated: number;
  lecturesCreated: number;
  extraction: SyllabusExtraction;
}

export async function ingestSyllabus({
  userId,
  fileUrl,
  input,
}: IngestSyllabusParams): Promise<IngestSyllabusResult> {
  const rawText = await extractRawText(input);
  const extraction = await extractSyllabus({ syllabusText: rawText });

  return prisma.$transaction(async (tx) => {
    const existingCourse = await tx.courses.findFirst({
      where: {
        user_id: userId,
        course_code: extraction.course.course_code,
        semester: extraction.course.semester,
      },
    });
    const course =
      existingCourse ??
      (await tx.courses.create({
        data: {
          user_id: userId,
          course_code: extraction.course.course_code,
          course_name: extraction.course.course_name,
          semester: extraction.course.semester,
        },
      }));

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
    };
  });
}
