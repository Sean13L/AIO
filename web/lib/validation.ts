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
// HH:MM string means a specific time.
export const todoCreateSchema = z.object({
  title: z.string().min(1),
  due_date: dateOnly.nullable().optional(),
  due_time: timeOnly.nullable().optional(),
});

export const todoUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  due_date: dateOnly.nullable().optional(),
  due_time: timeOnly.nullable().optional(),
});

export const extracurricularInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().nullable().optional(),
});

export const extracurricularUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().nullable().optional(),
});
