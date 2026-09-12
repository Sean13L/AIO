import type { Pool, PoolClient } from "pg";

// Freeform space for side projects/activities outside coursework — not tied
// to the grading/deadline schema. See CLAUDE.md's Organizational Database
// section.
export interface Extracurricular {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  created_at: string;
}

export interface ExtracurricularInput {
  title: string;
  content: string | null;
}

export interface ExtracurricularUpdate {
  title?: string;
  content?: string | null;
}

export async function listExtracurricularsForUser(
  db: Pool | PoolClient,
  userId: string
): Promise<Extracurricular[]> {
  const result = await db.query<Extracurricular>(
    "SELECT * FROM extracurriculars WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return result.rows;
}

export async function createExtracurricular(
  db: Pool | PoolClient,
  userId: string,
  input: ExtracurricularInput
): Promise<Extracurricular> {
  const result = await db.query<Extracurricular>(
    "INSERT INTO extracurriculars (user_id, title, content) VALUES ($1, $2, $3) RETURNING *",
    [userId, input.title, input.content]
  );
  return result.rows[0];
}

export async function updateExtracurricularForUser(
  db: Pool | PoolClient,
  userId: string,
  extracurricularId: string,
  update: ExtracurricularUpdate
): Promise<Extracurricular | null> {
  const fields = Object.keys(update) as (keyof ExtracurricularUpdate)[];
  if (fields.length === 0) {
    const existing = await db.query<Extracurricular>(
      "SELECT * FROM extracurriculars WHERE id = $1 AND user_id = $2",
      [extracurricularId, userId]
    );
    return existing.rows[0] ?? null;
  }

  const setClauses = fields.map((field, i) => `${field} = $${i + 1}`);
  const values = fields.map((field) => update[field]);

  const result = await db.query<Extracurricular>(
    `UPDATE extracurriculars SET ${setClauses.join(", ")}
     WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2}
     RETURNING *`,
    [...values, extracurricularId, userId]
  );
  return result.rows[0] ?? null;
}

export async function deleteExtracurricularForUser(
  db: Pool | PoolClient,
  userId: string,
  extracurricularId: string
): Promise<boolean> {
  const result = await db.query(
    "DELETE FROM extracurriculars WHERE id = $1 AND user_id = $2",
    [extracurricularId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
