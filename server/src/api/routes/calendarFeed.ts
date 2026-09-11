import { Router } from "express";
import { pool } from "../../db/client.js";
import { getOrCreateFeedForUser } from "../../db/repositories/calendarFeeds.js";

export const calendarFeedRouter = Router();

// Authenticated: returns (creating on first use) the caller's subscribable
// .ics feed URL. The URL itself carries the auth (an unguessable token),
// since calendar apps polling it can't send our X-User-Email header.
calendarFeedRouter.get("/calendar-feed", async (req, res, next) => {
  try {
    const feed = await getOrCreateFeedForUser(pool, req.userId!);
    const base = `${req.protocol}://${req.get("host")}`;
    res.json({ url: `${base}/calendar/${feed.feed_token}.ics` });
  } catch (err) {
    next(err);
  }
});
