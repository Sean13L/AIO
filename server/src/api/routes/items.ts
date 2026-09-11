import { Router } from "express";
import { pool } from "../../db/client.js";
import {
  deleteItemForUser,
  listItemsByUser,
  updateItemForUser,
  type ItemUpdate,
} from "../../db/repositories/items.js";
import { toTimestamp } from "../../util/timestamp.js";
import { itemUpdateSchema } from "../validation.js";

export const itemsRouter = Router();

// All items across every course for the current user — the "by due date"
// view referenced in CLAUDE.md's organizational database section.
itemsRouter.get("/items", async (req, res, next) => {
  try {
    const items = await listItemsByUser(pool, req.userId!);
    res.json(items);
  } catch (err) {
    next(err);
  }
});

itemsRouter.patch("/items/:itemId", async (req, res, next) => {
  try {
    const parsed = itemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { due_date, due_time, ...rest } = parsed.data;
    const update: ItemUpdate = { ...rest };
    if (due_date !== undefined) {
      update.due_at = toTimestamp(due_date, due_time ?? null);
      update.is_datetime = due_time !== null;
    }

    const item = await updateItemForUser(pool, req.userId!, req.params.itemId, update);
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

itemsRouter.delete("/items/:itemId", async (req, res, next) => {
  try {
    const deleted = await deleteItemForUser(pool, req.userId!, req.params.itemId);
    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
