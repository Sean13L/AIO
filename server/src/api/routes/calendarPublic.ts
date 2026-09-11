import { Router } from "express";
import { pool } from "../../db/client.js";
import { getUserIdByFeedToken } from "../../db/repositories/calendarFeeds.js";
import { listItemsWithCourseForUser } from "../../db/repositories/items.js";
import { listLecturesWithCourseForUser } from "../../db/repositories/lectures.js";
import { buildIcsFeed } from "../../calendar/icsBuilder.js";

export const calendarPublicRouter = Router();

// Public (no resolveUser) — this is the URL a calendar app subscribes to.
// The feed_token itself is the auth: unguessable, one per user.
calendarPublicRouter.get("/calendar/:token.ics", async (req, res, next) => {
  try {
    const userId = await getUserIdByFeedToken(pool, req.params.token);
    if (!userId) {
      res.status(404).send("Feed not found");
      return;
    }

    const [items, lectures] = await Promise.all([
      listItemsWithCourseForUser(pool, userId),
      listLecturesWithCourseForUser(pool, userId),
    ]);

    const webBaseUrl = process.env.WEB_BASE_URL ?? "http://localhost:3000";
    const ics = buildIcsFeed({ items, lectures, webBaseUrl });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="calendar.ics"');
    res.send(ics);
  } catch (err) {
    next(err);
  }
});
