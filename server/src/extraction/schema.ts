import { z } from "zod";

// Mirrors the `item_type` Postgres enum in schema.sql.
export const itemTypeSchema = z.enum([
  "assignment",
  "quiz",
  "midterm",
  "final_exam",
  "project",
  "peer_evaluation",
  "other",
]);

export const extractedItemSchema = z.object({
  name: z.string(),
  type: itemTypeSchema,
  // Date the item is due, as YYYY-MM-DD.
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Time of day if the syllabus specifies a real deadline time (e.g. "2:00 PM"),
  // as HH:MM in 24h format. Null when the syllabus only gives a date.
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  // Mirrors items.is_datetime: true only when due_time is a real, syllabus-specified time.
  is_datetime: z.boolean(),
  weight: z.string().nullable(),
  notes: z.string().nullable(),
});

export const extractedLectureSchema = z.object({
  week_number: z.number().int().nullable(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Lectures always have a real time slot — see Calendar section in CLAUDE.md.
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
  topics: z.string().nullable(),
});

export const gradingComponentSchema = z.object({
  component: z.string(),
  weight: z.string(),
});

export const syllabusExtractionSchema = z.object({
  course: z.object({
    course_code: z.string(),
    course_name: z.string(),
    semester: z.string().nullable(),
  }),
  grading_scheme: z.array(gradingComponentSchema),
  policies: z.object({
    late_work: z.string().nullable(),
    attendance: z.string().nullable(),
    academic_integrity: z.string().nullable(),
    regrade_policy: z.string().nullable(),
    other: z.string().nullable(),
  }),
  required_tools: z.array(z.string()),
  items: z.array(extractedItemSchema),
  lectures: z.array(extractedLectureSchema),
});

export type SyllabusExtraction = z.infer<typeof syllabusExtractionSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type ExtractedLecture = z.infer<typeof extractedLectureSchema>;
