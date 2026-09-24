import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { studyGuideRegenerateSchema } from "@/lib/validation";
import { buildStudyGuideMaterial } from "@/lib/studyGuide/buildStudyGuideMaterial";
import { generateStudyGuide } from "@/lib/studyGuide/generateStudyGuide";
import { STUDY_GUIDE_DETAIL_INCLUDE, serializeStudyGuide } from "@/lib/studyGuide/serialize";
import {
  geminiUsageLimitMessage,
  recordGeminiCallAndCheckLimit,
  refundGeminiCall,
} from "@/lib/geminiUsage";

// Re-runs generation from the guide's existing lecture/content-type
// selections (study_guide_sources) — not a new selection. This is the
// intended way to pick up changes since the guide was made (newly uploaded
// slides, a transcript recorded/edited afterward), or just to get a fresh
// take with a different focus. Picking different lectures entirely is what
// creating a new guide is for.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.study_guides.findFirst({
    where: { id, user_id: userId },
    include: { sources: true },
  });
  if (!existing) return NextResponse.json({ error: "Study guide not found" }, { status: 404 });

  const parsed = studyGuideRegenerateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const selections = existing.sources.map((source) => ({
    lecture_id: source.lecture_id,
    include_topics: source.included_topics,
    include_slides: source.included_slides,
    include_transcript: source.included_transcript,
    include_notes: source.included_notes,
  }));

  const { sections } = await buildStudyGuideMaterial(userId, selections);
  if (sections.length === 0 && !existing.notes) {
    return NextResponse.json(
      {
        error:
          "None of this guide's source lectures have any content to include anymore (they may have been deleted or edited) — create a new study guide instead.",
      },
      { status: 400 }
    );
  }

  const usage = await recordGeminiCallAndCheckLimit(userId);
  if (!usage.allowed) {
    return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
  }

  const focus = parsed.data.focus !== undefined ? parsed.data.focus || null : existing.focus;
  let generated: Awaited<ReturnType<typeof generateStudyGuide>>;
  try {
    generated = await generateStudyGuide({ sections, focus, notes: existing.notes });
  } catch (err) {
    await refundGeminiCall(userId, usage.date);
    throw err;
  }
  const { content, usedMock } = generated;

  const updated = await prisma.study_guides.update({
    where: { id },
    data: {
      title: parsed.data.title ?? existing.title,
      focus,
      content,
      used_mock: usedMock,
    },
    include: STUDY_GUIDE_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeStudyGuide(updated));
}
