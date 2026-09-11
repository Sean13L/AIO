import { Router } from "express";
import { pool } from "../../db/client.js";
import {
  createCourse,
  deleteCourseForUser,
  getCourseForUser,
  listCoursesByUser,
} from "../../db/repositories/courses.js";
import { createItem, listItemsByCourse } from "../../db/repositories/items.js";
import { listLecturesByCourse } from "../../db/repositories/lectures.js";
import { toTimestamp } from "../../util/timestamp.js";
import { courseInputSchema, itemCreateSchema } from "../validation.js";

export const coursesRouter = Router();

coursesRouter.get("/courses", async (req, res, next) => {
  try {
    const courses = await listCoursesByUser(pool, req.userId!);
    res.json(courses);
  } catch (err) {
    next(err);
  }
});

coursesRouter.post("/courses", async (req, res, next) => {
  try {
    const parsed = courseInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const course = await createCourse(pool, req.userId!, {
      course_code: parsed.data.course_code,
      course_name: parsed.data.course_name,
      semester: parsed.data.semester ?? null,
    });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
});

coursesRouter.get("/courses/:courseId", async (req, res, next) => {
  try {
    const course = await getCourseForUser(pool, req.userId!, req.params.courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(course);
  } catch (err) {
    next(err);
  }
});

coursesRouter.delete("/courses/:courseId", async (req, res, next) => {
  try {
    const deleted = await deleteCourseForUser(pool, req.userId!, req.params.courseId);
    if (!deleted) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

coursesRouter.get("/courses/:courseId/items", async (req, res, next) => {
  try {
    const course = await getCourseForUser(pool, req.userId!, req.params.courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    const items = await listItemsByCourse(pool, course.id);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

coursesRouter.post("/courses/:courseId/items", async (req, res, next) => {
  try {
    const course = await getCourseForUser(pool, req.userId!, req.params.courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const parsed = itemCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const item = await createItem(
      pool,
      course.id,
      {
        name: parsed.data.name,
        type: parsed.data.type,
        due_at: toTimestamp(parsed.data.due_date, parsed.data.due_time),
        is_datetime: parsed.data.due_time !== null,
        weight: parsed.data.weight ?? null,
        notes: parsed.data.notes ?? null,
      },
      "manual"
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

coursesRouter.get("/courses/:courseId/lectures", async (req, res, next) => {
  try {
    const course = await getCourseForUser(pool, req.userId!, req.params.courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    const lectures = await listLecturesByCourse(pool, course.id);
    res.json(lectures);
  } catch (err) {
    next(err);
  }
});
