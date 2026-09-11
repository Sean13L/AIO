import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/client.js";
import {
  createIcsSyncTargetForUser,
  deleteSyncTargetForUser,
  listSyncTargetsForUser,
} from "../../db/repositories/calendarSyncTargets.js";

export const calendarSyncTargetsRouter = Router();

const createSchema = z.object({ label: z.string().min(1) });

calendarSyncTargetsRouter.get("/calendar-feed/sync-targets", async (req, res, next) => {
  try {
    const targets = await listSyncTargetsForUser(pool, req.userId!);
    res.json(targets);
  } catch (err) {
    next(err);
  }
});

calendarSyncTargetsRouter.post("/calendar-feed/sync-targets", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const target = await createIcsSyncTargetForUser(pool, req.userId!, parsed.data.label);
    res.status(201).json(target);
  } catch (err) {
    next(err);
  }
});

calendarSyncTargetsRouter.delete("/calendar-feed/sync-targets/:targetId", async (req, res, next) => {
  try {
    const deleted = await deleteSyncTargetForUser(pool, req.userId!, req.params.targetId);
    if (!deleted) {
      res.status(404).json({ error: "Sync target not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
