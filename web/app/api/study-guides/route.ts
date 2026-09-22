import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { studyGuideCreateSchema } from "@/lib/validation";
import { buildStudyGuideMaterial } from "@/lib/studyGuide/buildStudyGuideMaterial";
import { generateStudyGuide } from "@/lib/studyGuide/generateStudyGuide";
import { STUDY_GUIDE_DETAIL_INCLUDE, serializeStudyGuide } from "@/lib/studyGuide/serialize";
import { geminiUsageLimitMessage, recordGeminiCallAndCheckLimit } from "@/lib/geminiUsage";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const guides = await prisma.study_guides.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      title: true,
      created_at: true,
      used_mock: true,
      _count: { select: { sources: true } },
    },
  });

  return NextResponse.json(
    guides.map(({ _count, ...guide }) => ({ ...guide, lecture_count: _count.sources }))
  );
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = studyGuideCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, focus, lectures } = parsed.data;

  const { sections } = await buildStudyGuideMaterial(userId, lectures);
  if (sections.length === 0) {
    return NextResponse.json(
      {
        error:
          "None of the selected lectures had any content to include — pick lectures with topics, slides, or a transcript, or check different content types.",
      },
      { status: 400 }
    );
  }

  const usage = await recordGeminiCallAndCheckLimit(userId);
  if (!usage.allowed) {
    return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
  }

  const { content, usedMock } = await generateStudyGuide({
    sections,
    focus: focus?.trim() || null,
  });

  const defaultTitle =
    sections.length === 1
      ? `Study guide — ${sections[0].label}`
      : `Study guide — ${sections.length} lectures`;

  const guide = await prisma.study_guides.create({
    data: {
      user_id: userId,
      title: title?.trim() || defaultTitle,
      focus: focus?.trim() || null,
      content,
      used_mock: usedMock,
      sources: {
        create: sections.map((section) => ({
          lecture_id: section.lectureId,
          included_topics: section.includedTopics,
          included_slides: section.includedSlides,
          included_transcript: section.includedTranscript,
        })),
      },
    },
    include: STUDY_GUIDE_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeStudyGuide(guide), { status: 201 });
}
