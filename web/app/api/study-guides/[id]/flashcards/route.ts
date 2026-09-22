import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { generateFlashcards } from "@/lib/studyGuide/generateFlashcards";
import { geminiUsageLimitMessage, recordGeminiCallAndCheckLimit } from "@/lib/geminiUsage";

// Generates (or regenerates — calling this again just overwrites) a
// flashcard set from the study guide's own content, not the original
// lectures — the guide is already the curated/synthesized material, so
// there's no need to re-fetch slides/transcripts here.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const guide = await prisma.study_guides.findFirst({ where: { id, user_id: userId } });
  if (!guide) return NextResponse.json({ error: "Study guide not found" }, { status: 404 });

  const usage = await recordGeminiCallAndCheckLimit(userId);
  if (!usage.allowed) {
    return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
  }

  const { cards, usedMock } = await generateFlashcards({
    studyGuideTitle: guide.title,
    studyGuideContent: guide.content,
  });

  const updated = await prisma.study_guides.update({
    where: { id },
    data: { flashcards: cards, flashcards_used_mock: usedMock },
  });

  return NextResponse.json({ cards: updated.flashcards, used_mock: updated.flashcards_used_mock });
}
