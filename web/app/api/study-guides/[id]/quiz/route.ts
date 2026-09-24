import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { generateQuiz } from "@/lib/studyGuide/generateQuiz";
import {
  geminiUsageLimitMessage,
  recordGeminiCallAndCheckLimit,
  refundGeminiCall,
} from "@/lib/geminiUsage";

// Generates (or regenerates — calling this again just overwrites) a
// multiple-choice quiz from the study guide's own content. See flashcards
// route for why this reads the guide's content rather than re-fetching the
// original lectures.
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

  let generated: Awaited<ReturnType<typeof generateQuiz>>;
  try {
    generated = await generateQuiz({
      studyGuideTitle: guide.title,
      studyGuideContent: guide.content,
      userId,
    });
  } catch (err) {
    await refundGeminiCall(userId, usage.date);
    throw err;
  }
  const { questions, usedMock } = generated;

  const updated = await prisma.study_guides.update({
    where: { id },
    data: { quiz: questions, quiz_used_mock: usedMock },
  });

  return NextResponse.json({ questions: updated.quiz, used_mock: updated.quiz_used_mock });
}
