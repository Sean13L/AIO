import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import "./types.js";
import { resolveUser } from "./middleware/resolveUser.js";
import { coursesRouter } from "./routes/courses.js";
import { itemsRouter } from "./routes/items.js";
import { calendarFeedRouter } from "./routes/calendarFeed.js";
import { calendarPublicRouter } from "./routes/calendarPublic.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", resolveUser, coursesRouter, itemsRouter, calendarFeedRouter);

  // Public — no resolveUser. The feed_token in the URL is the auth, since
  // calendar apps polling this can't send our X-User-Email header.
  app.use(calendarPublicRouter);

  // Error handler — must be registered after routes; 4-arg signature is how
  // Express recognizes it as one regardless of registration order.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
