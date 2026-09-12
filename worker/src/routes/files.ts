import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { requireWorkerApiKey } from "../auth.js";
import { filePath, isSafeFilename, type Namespace } from "../storage.js";
import { extractRawText } from "../extraction/parseFile.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const filesRouter = Router();

function isNamespace(value: string): value is Namespace {
  return value === "lectures" || value === "syllabi";
}

// Internal — only the web app's backend calls this (bearer auth), never a
// browser directly.
filesRouter.post("/files/:namespace", requireWorkerApiKey, upload.single("file"), (req, res) => {
  const { namespace } = req.params;
  if (!isNamespace(namespace)) {
    res.status(400).json({ error: "Unknown namespace" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded (expected form field 'file')" });
    return;
  }

  // Callers may request a specific filename (e.g. "<lectureId>.pdf", so a
  // re-upload cleanly replaces the previous slides); otherwise one is
  // generated.
  const requestedName = typeof req.body.filename === "string" ? req.body.filename : null;
  const filename =
    requestedName && isSafeFilename(requestedName)
      ? requestedName
      : `${crypto.randomUUID()}${path.extname(req.file.originalname)}`;

  fs.writeFileSync(filePath(namespace, filename), req.file.buffer);

  const base = `${req.protocol}://${req.get("host")}`;
  res.json({ filename, url: `${base}/files/${namespace}/${filename}` });
});

// Public — no auth. Same trust model as the unauthenticated local static
// serving this replaces (an unguessable-ish filename is the only gate).
filesRouter.get("/files/:namespace/:filename", (req, res) => {
  const { namespace, filename } = req.params;
  if (!isNamespace(namespace) || !isSafeFilename(filename)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const target = filePath(namespace, filename);
  if (!fs.existsSync(target)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.sendFile(target);
});

// Internal — lets the (serverless) web app get a slide file's extracted
// text synchronously, without needing filesystem access itself.
filesRouter.get(
  "/files/:namespace/:filename/text",
  requireWorkerApiKey,
  async (req, res, next) => {
    try {
      const { namespace, filename } = req.params;
      if (!isNamespace(namespace) || !isSafeFilename(filename)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const target = filePath(namespace, filename);
      if (!fs.existsSync(target)) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const text = await extractRawText({
        kind: "file",
        buffer: fs.readFileSync(target),
        fileName: filename,
      });
      res.json({ text });
    } catch (err) {
      next(err);
    }
  }
);
