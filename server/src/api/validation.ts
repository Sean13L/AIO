import { z } from "zod";
import { itemTypeSchema } from "../extraction/schema.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const timeOnly = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");

export const courseInputSchema = z.object({
  course_code: z.string().min(1),
  course_name: z.string().min(1),
  semester: z.string().nullable().optional(),
});

export const itemCreateSchema = z.object({
  name: z.string().min(1),
  type: itemTypeSchema,
  due_date: dateOnly,
  due_time: timeOnly.nullable(),
  weight: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const itemUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: itemTypeSchema.optional(),
    due_date: dateOnly.optional(),
    due_time: timeOnly.nullable().optional(),
    weight: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.enum(["not_started", "in_progress", "done"]).optional(),
  })
  .refine((body) => (body.due_date === undefined) === (body.due_time === undefined), {
    message: "due_date and due_time must be provided together (use null for an all-day item)",
  });
