import type { Pool, PoolClient } from "pg";

export type ItemType =
  | "assignment"
  | "quiz"
  | "midterm"
  | "final_exam"
  | "project"
  | "peer_evaluation"
  | "other";

export type ItemStatus = "not_started" | "in_progress" | "done";
export type ItemSource = "extracted" | "manual";

export interface Item {
  id: string;
  course_id: string;
  name: string;
  type: ItemType;
  due_at: string;
  is_datetime: boolean;
  weight: string | null;
  notes: string | null;
  status: ItemStatus;
  source: ItemSource;
  created_at: string;
}

export interface ItemInput {
  name: string;
  type: ItemType;
  due_at: string; // ISO timestamp
  is_datetime: boolean;
  weight: string | null;
  notes: string | null;
}

export interface ItemUpdate {
  name?: string;
  type?: ItemType;
  due_at?: string;
  is_datetime?: boolean;
  weight?: string | null;
  notes?: string | null;
  status?: ItemStatus;
}

export async function listItemsByCourse(
  db: Pool | PoolClient,
  courseId: string
): Promise<Item[]> {
  const result = await db.query<Item>(
    "SELECT * FROM items WHERE course_id = $1 ORDER BY due_at",
    [courseId]
  );
  return result.rows;
}

// Joins through courses so callers can scope "all my items" by user without
// a denormalized user_id on items.
export async function listItemsByUser(
  db: Pool | PoolClient,
  userId: string
): Promise<Item[]> {
  const result = await db.query<Item>(
    `SELECT items.* FROM items
     JOIN courses ON courses.id = items.course_id
     WHERE courses.user_id = $1
     ORDER BY items.due_at`,
    [userId]
  );
  return result.rows;
}

export async function getItemForUser(
  db: Pool | PoolClient,
  userId: string,
  itemId: string
): Promise<Item | null> {
  const result = await db.query<Item>(
    `SELECT items.* FROM items
     JOIN courses ON courses.id = items.course_id
     WHERE items.id = $1 AND courses.user_id = $2`,
    [itemId, userId]
  );
  return result.rows[0] ?? null;
}

export async function createItem(
  db: Pool | PoolClient,
  courseId: string,
  input: ItemInput,
  source: ItemSource = "manual"
): Promise<Item> {
  const result = await db.query<Item>(
    `INSERT INTO items (course_id, name, type, due_at, is_datetime, weight, notes, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      courseId,
      input.name,
      input.type,
      input.due_at,
      input.is_datetime,
      input.weight,
      input.notes,
      source,
    ]
  );
  return result.rows[0];
}

export async function updateItemForUser(
  db: Pool | PoolClient,
  userId: string,
  itemId: string,
  update: ItemUpdate
): Promise<Item | null> {
  const fields = Object.keys(update) as (keyof ItemUpdate)[];
  if (fields.length === 0) {
    return getItemForUser(db, userId, itemId);
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 1}`);
  const values = fields.map((field) => update[field]);

  const result = await db.query<Item>(
    `UPDATE items SET ${setClauses.join(", ")}
     WHERE id = $${fields.length + 1}
       AND course_id IN (SELECT id FROM courses WHERE user_id = $${fields.length + 2})
     RETURNING *`,
    [...values, itemId, userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteItemForUser(
  db: Pool | PoolClient,
  userId: string,
  itemId: string
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM items
     WHERE id = $1
       AND course_id IN (SELECT id FROM courses WHERE user_id = $2)`,
    [itemId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
