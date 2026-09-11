import type { NextFunction, Request, Response } from "express";
import { pool } from "../../db/client.js";
import { findOrCreateUserByEmail } from "../../db/repositories/users.js";

// Dev-mode stand-in for real auth: identifies the caller by email (no
// password/session), auto-provisioning the user on first use. Fine for a
// single-user personal tool; revisit if/when real accounts are needed.
export async function resolveUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const email =
    (req.header("x-user-email") ?? (req.query.email as string | undefined))?.trim();

  if (!email) {
    res.status(400).json({
      error: "Missing user email — pass an X-User-Email header or ?email= query param.",
    });
    return;
  }

  try {
    const user = await findOrCreateUserByEmail(pool, email);
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    next(err);
  }
}
