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
