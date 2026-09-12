import express, { type NextFunction, type Request, type Response } from "express";
import { filesRouter } from "./routes/files.js";

export function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(filesRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
