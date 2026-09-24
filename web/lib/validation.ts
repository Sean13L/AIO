import { z } from "zod";
import { item_status, item_type } from "@prisma/client";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");

export const courseInputSchema = z.object({
  course_code: z.string().min(1),
  course_name: z.string().min(1),
  semester: z.string().nullable().optional(),
});

export const itemCreateSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(item_type),
  due_date: dateOnly,
  due_time: timeOnly.nullable(),
  weight: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Lectures always have a real time slot (never all-day) — see the Calendar
// section of CLAUDE.md — so scheduled_time is required, unlike items.
export const lectureCreateSchema = z.object({
  scheduled_date: dateOnly,
  scheduled_time: timeOnly,
  week_number: z.number().int().min(0).max(99).nullable().optional(),
  topics: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().max(200_000).nullable().optional(),
});

export const lectureUpdateSchema = z
  .object({
    transcript: z.string().nullable().optional(),
    notes: z.string().max(200_000).nullable().optional(),
    topics: z.string().trim().max(2000).nullable().optional(),
    week_number: z.number().int().min(0).max(99).nullable().optional(),
    scheduled_date: dateOnly.optional(),
    scheduled_time: timeOnly.optional(),
  })
  .refine((body) => (body.scheduled_date === undefined) === (body.scheduled_time === undefined), {
    message: "scheduled_date and scheduled_time must be provided together",
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });

export const itemUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.nativeEnum(item_type).optional(),
    due_date: dateOnly.optional(),
    due_time: timeOnly.nullable().optional(),
    weight: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.nativeEnum(item_status).optional(),
  })
  .refine((body) => (body.due_date === undefined) === (body.due_time === undefined), {
    message: "due_date and due_time must be provided together (use null for an all-day item)",
  });

// due_date/due_time are both optional (unlike items, where due_date is
// required) — a todo may have no deadline at all. When due_date is given,
// due_time follows the same convention as items: null means all-day, a
// HH:MM string means a specific time. show_on_calendar can only be true
// alongside a due_date — a todo with no deadline has no date to place on a
// calendar. The update schema can't fully enforce this (show_on_calendar
// may be set true in a request that doesn't touch due_date, relying on a
// deadline already saved), so the route checks the resolved state itself.
export const todoCreateSchema = z
  .object({
    title: z.string().min(1),
    due_date: dateOnly.nullable().optional(),
    due_time: timeOnly.nullable().optional(),
    show_on_calendar: z.boolean().optional(),
  })
  .refine((body) => !body.show_on_calendar || !!body.due_date, {
    message: "show_on_calendar requires a due_date",
    path: ["show_on_calendar"],
  });

export const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  due_date: dateOnly.nullable().optional(),
  due_time: timeOnly.nullable().optional(),
  show_on_calendar: z.boolean().optional(),
});

export const extracurricularInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().nullable().optional(),
});

export const extracurricularUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().nullable().optional(),
});

export const studyGuideLectureSelectionSchema = z.object({
  lecture_id: z.string().uuid(),
  include_topics: z.boolean().optional().default(true),
  include_slides: z.boolean().optional().default(true),
  include_transcript: z.boolean().optional().default(true),
  include_notes: z.boolean().optional().default(true),
});

export const studyGuideCreateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  focus: z.string().trim().max(500).optional(),
  // No minimum here — a guide can be built from uploaded/pasted notes alone
  // with zero lectures selected; the route enforces "at least *something*
  // to build from" across lectures + notes combined, not lectures alone.
  lectures: z.array(studyGuideLectureSelectionSchema).default([]),
});

// Regenerating reuses the study guide's existing lecture/content-type
// selections (see study_guide_sources) — only title/focus are optionally
// overridable, and only actually changed if provided (undefined leaves the
// stored value as-is; empty string clears it).
export const studyGuideRegenerateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  focus: z.string().trim().max(500).optional(),
});
