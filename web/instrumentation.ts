// Runs once when the Next.js server starts (App Router built-in hook, no
// experimental flag needed as of Next 15). Node-only guard because this
// also gets called in the edge runtime, which can't run our scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPreviewScheduler } = await import("./lib/scheduler");
    startPreviewScheduler();
  }
}
