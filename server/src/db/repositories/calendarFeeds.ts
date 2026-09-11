import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";

export interface CalendarFeed {
  id: string;
  user_id: string;
  feed_token: string;
  created_at: string;
}

export async function getOrCreateFeedForUser(
  db: Pool | PoolClient,
  userId: string
): Promise<CalendarFeed> {
  const existing = await db.query<CalendarFeed>(
    "SELECT * FROM calendar_feeds WHERE user_id = $1",
    [userId]
  );
  if (existing.rows[0]) return existing.rows[0];

  // 24 random bytes (48 hex chars) — unguessable, per schema.sql's comment on feed_token.
  const token = crypto.randomBytes(24).toString("hex");
  const inserted = await db.query<CalendarFeed>(
    "INSERT INTO calendar_feeds (user_id, feed_token) VALUES ($1, $2) RETURNING *",
    [userId, token]
  );
  return inserted.rows[0];
}

export async function getUserIdByFeedToken(
  db: Pool | PoolClient,
  token: string
): Promise<string | null> {
  const result = await db.query<{ user_id: string }>(
    "SELECT user_id FROM calendar_feeds WHERE feed_token = $1",
    [token]
  );
  return result.rows[0]?.user_id ?? null;
}
