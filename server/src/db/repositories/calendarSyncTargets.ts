import type { Pool, PoolClient } from "pg";
import { getOrCreateFeedForUser } from "./calendarFeeds.js";

export type SyncTargetType = "ics_subscriber" | "google_oauth";

export interface CalendarSyncTarget {
  id: string;
  feed_id: string;
  target_type: SyncTargetType;
  label: string | null;
  google_oauth_token: string | null;
  created_at: string;
}

export async function listSyncTargetsForUser(
  db: Pool | PoolClient,
  userId: string
): Promise<CalendarSyncTarget[]> {
  const result = await db.query<CalendarSyncTarget>(
    `SELECT calendar_sync_targets.* FROM calendar_sync_targets
     JOIN calendar_feeds ON calendar_feeds.id = calendar_sync_targets.feed_id
     WHERE calendar_feeds.user_id = $1
     ORDER BY calendar_sync_targets.created_at`,
    [userId]
  );
  return result.rows;
}

// Only 'ics_subscriber' targets can be created through the API right now —
// direct Google OAuth push isn't implemented (see CLAUDE.md: "v2 enhancement
// if instant sync turns out to matter"). A label doesn't create a separate
// feed; it just tracks who the student has shared the one feed URL with.
export async function createIcsSyncTargetForUser(
  db: Pool | PoolClient,
  userId: string,
  label: string
): Promise<CalendarSyncTarget> {
  const feed = await getOrCreateFeedForUser(db, userId);
  const result = await db.query<CalendarSyncTarget>(
    `INSERT INTO calendar_sync_targets (feed_id, target_type, label)
     VALUES ($1, 'ics_subscriber', $2) RETURNING *`,
    [feed.id, label]
  );
  return result.rows[0];
}

export async function deleteSyncTargetForUser(
  db: Pool | PoolClient,
  userId: string,
  targetId: string
): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM calendar_sync_targets
     WHERE id = $1 AND feed_id IN (SELECT id FROM calendar_feeds WHERE user_id = $2)`,
    [targetId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
