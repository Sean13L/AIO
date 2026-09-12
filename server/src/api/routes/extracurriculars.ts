import { Router } from "express";
import { pool } from "../../db/client.js";
import {
  createExtracurricular,
  deleteExtracurricularForUser,
  listExtracurricularsForUser,
  updateExtracurricularForUser,
} from "../../db/repositories/extracurriculars.js";
import { extracurricularInputSchema, extracurricularUpdateSchema } from "../validation.js";

export const extracurricularsRouter = Router();

extracurricularsRouter.get("/extracurriculars", async (req, res, next) => {
  try {
    const items = await listExtracurricularsForUser(pool, req.userId!);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

extracurricularsRouter.post("/extracurriculars", async (req, res, next) => {
  try {
    const parsed = extracurricularInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const item = await createExtracurricular(pool, req.userId!, {
      title: parsed.data.title,
      content: parsed.data.content ?? null,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

extracurricularsRouter.patch("/extracurriculars/:extracurricularId", async (req, res, next) => {
  try {
    const parsed = extracurricularUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const item = await updateExtracurricularForUser(
      pool,
      req.userId!,
      req.params.extracurricularId,
      parsed.data
    );
    if (!item) {
      res.status(404).json({ error: "Extracurricular not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

extracurricularsRouter.delete("/extracurriculars/:extracurricularId", async (req, res, next) => {
  try {
    const deleted = await deleteExtracurricularForUser(
      pool,
      req.userId!,
      req.params.extracurricularId
    );
    if (!deleted) {
      res.status(404).json({ error: "Extracurricular not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
