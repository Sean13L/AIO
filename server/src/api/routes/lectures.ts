import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { pool } from "../../db/client.js";
import { getCourseForUser } from "../../db/repositories/courses.js";
import {
  getLectureForUser,
  markLecturePreviewViewed,
  setLecturePreview,
  setLectureSlidesUrl,
} from "../../db/repositories/lectures.js";
import { lectureUploadsDir, readSlidesText } from "../../preview/readSlidesText.js";
import { generatePreview } from "../../preview/generatePreview.js";

fs.mkdirSync(lectureUploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, lectureUploadsDir),
    filename: (req, file, cb) => {
      cb(null, `${req.params.lectureId}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const lecturesRouter = Router();

lecturesRouter.get("/lectures/:lectureId", async (req, res, next) => {
  try {
    const lecture = await getLectureForUser(pool, req.userId!, req.params.lectureId);
    if (!lecture) {
      res.status(404).json({ error: "Lecture not found" });
      return;
    }

    // Viewing the page is what flips "generated" -> "viewed".
    await markLecturePreviewViewed(pool, lecture.id);
    if (lecture.preview_status === "generated") {
      lecture.preview_status = "viewed";
    }

    res.json(lecture);
  } catch (err) {
    next(err);
  }
});

lecturesRouter.post(
  "/lectures/:lectureId/slides",
  upload.single("slides"),
  async (req, res, next) => {
    try {
      const lecture = await getLectureForUser(pool, req.userId!, req.params.lectureId);
      if (!lecture) {
        res.status(404).json({ error: "Lecture not found" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded (expected form field 'slides')" });
        return;
      }

      const base = `${req.protocol}://${req.get("host")}`;
      const slidesUrl = `${base}/uploads/lectures/${req.file.filename}`;
      const updated = await setLectureSlidesUrl(pool, lecture.id, slidesUrl);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

lecturesRouter.post("/lectures/:lectureId/generate-preview", async (req, res, next) => {
  try {
    const lecture = await getLectureForUser(pool, req.userId!, req.params.lectureId);
    if (!lecture) {
      res.status(404).json({ error: "Lecture not found" });
      return;
    }
    const course = await getCourseForUser(pool, req.userId!, lecture.course_id);

    const slidesText = await readSlidesText(lecture.slides_url);
    const previewContent = await generatePreview({
      courseCode: course?.course_code ?? "Course",
      topics: lecture.topics,
      slidesText,
    });

    const updated = await setLecturePreview(pool, lecture.id, previewContent);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
