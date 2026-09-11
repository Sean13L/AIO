import type {} from "express";

// No auth system yet (single-user model, not yet specified how accounts log
// in — see CLAUDE.md User Model). resolveUser middleware identifies the
// caller by email (header or query param) and auto-provisions a user row,
// attaching it here for route handlers.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}
