import { NextRequest, NextResponse } from "next/server";
import { runPreviewCron } from "@/lib/preview/runPreviewCron";
import { pruneGeminiErrors } from "@/lib/geminiErrors";

// runPreviewCron() stops itself at a 50s time budget; this is the hard
// ceiling above it (safe on every Vercel plan).
export const maxDuration = 60;

// Triggered by Vercel Cron (see vercel.json) in place of the always-on
// polling loop the old worker/src/scheduler.ts ran. Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` automatically for scheduled
// invocations when CRON_SECRET is set — verify it so this can't be
// triggered by anyone who finds the URL. Locally/in CI, where CRON_SECRET
// is typically unset, the check is skipped so this stays testable without
// needing the header — but that skip is scoped to non-production so an
// unset CRON_SECRET can never leave this open on a real deployment.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[generate-previews cron] CRON_SECRET is not set in production — refusing to run unauthenticated.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const result = await runPreviewCron();
  console.log("[generate-previews cron]", JSON.stringify(result));

  // Housekeeping for the gemini_errors record — piggybacks on the only
  // scheduled job Studdy already has, rather than adding a second cron.
  try {
    await pruneGeminiErrors();
  } catch (err) {
    console.error("[generate-previews cron] failed to prune gemini_errors:", err);
  }

  return NextResponse.json(result);
}
