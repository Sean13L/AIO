import type { Pool, PoolClient } from "pg";

export interface User {
  id: string;
  email: string;
}

export async function findOrCreateUserByEmail(
  db: Pool | PoolClient,
  email: string
): Promise<User> {
  const existing = await db.query<User>(
    "SELECT id, email FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await db.query<User>(
    "INSERT INTO users (email) VALUES ($1) RETURNING id, email",
    [email]
  );
  return inserted.rows[0];
}

export async function getUserByEmail(
  db: Pool | PoolClient,
  email: string
): Promise<User | null> {
  const result = await db.query<User>(
    "SELECT id, email FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] ?? null;
}
