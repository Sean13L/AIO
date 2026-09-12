import type { NextFunction, Request, Response } from "express";

// This service is only meant to be reachable from the web app's backend
// (server-to-server) for uploads and text extraction — never directly from
// a browser for those operations. A shared bearer token is enough for that;
// it's not protecting anything a real end user is meant to authenticate
// against. File *downloads* (GET /files/:namespace/:filename) are
// deliberately left open — same trust model as the unauthenticated local
// static serving this replaces.
export function requireWorkerApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.WORKER_API_KEY;
  if (!expected) {
    res.status(500).json({ error: "WORKER_API_KEY is not configured on the worker" });
    return;
  }

  const header = req.header("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (provided !== expected) {
    res.status(401).json({ error: "Invalid or missing worker API key" });
    return;
  }

  next();
}
