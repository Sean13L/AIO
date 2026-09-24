import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getAiUsageSummary } from "@/lib/aiUsage";

// Backs Settings > AI usage: the signed-in user's own daily AI budget,
// recent history, and failed Gemini requests — never anyone else's.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json(await getAiUsageSummary(userId));
}
