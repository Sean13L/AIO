import crypto from "node:crypto";
import { prisma } from "./prisma";

export async function getOrCreateFeedForUser(userId: string) {
  const existing = await prisma.calendar_feeds.findFirst({ where: { user_id: userId } });
  if (existing) return existing;

  // 24 random bytes (48 hex chars) — unguessable, per schema.sql's comment on feed_token.
  const token = crypto.randomBytes(24).toString("hex");
  return prisma.calendar_feeds.create({ data: { user_id: userId, feed_token: token } });
}
