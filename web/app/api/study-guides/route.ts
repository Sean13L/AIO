import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { studyGuideCreateSchema } from "@/lib/validation";
import { buildStudyGuideMaterial } from "@/lib/studyGuide/buildStudyGuideMaterial";
import { generateStudyGuide } from "@/lib/studyGuide/generateStudyGuide";
import { STUDY_GUIDE_DETAIL_INCLUDE, serializeStudyGuide } from "@/lib/studyGuide/serialize";
import {
  geminiUsageLimitMessage,
  recordGeminiCallAndCheckLimit,
  refundGeminiCall,
} from "@/lib/geminiUsage";
import { extractRawText } from "@/lib/extraction/parseFile";
import { assertAllowedUpload, NOTES_EXTENSIONS, NOTES_MAX_BYTES } from "@/lib/uploadValidation";

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

// Multipart, not JSON — "lectures" arrives as a JSON-encoded string field
// alongside it, since a plain JSON body can't carry the uploaded note
// files.
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const formData = await req.formData();

  let lecturesRaw: unknown = [];
  const lecturesField = formData.get("lectures");
  if (typeof lecturesField === "string" && lecturesField.trim()) {
    try {
      lecturesRaw = JSON.parse(lecturesField);
    } catch {
      return NextResponse.json({ error: "'lectures' must be valid JSON" }, { status: 400 });
    }
  }

  const parsed = studyGuideCreateSchema.safeParse({
    title: formData.get("title") || undefined,
    focus: formData.get("focus") || undefined,
    lectures: lecturesRaw,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, focus, lectures } = parsed.data;

  const { sections } = await buildStudyGuideMaterial(userId, lectures);

  // Supplementary notes: pasted text and/or uploaded files, concatenated —
  // parsed for their text only, never archived to storage (see
  // study_guides.notes).
  const notesParts: string[] = [];
  const notesTextRaw = formData.get("notes_text");
  if (typeof notesTextRaw === "string" && notesTextRaw.trim()) {
    notesParts.push(notesTextRaw.trim());
  }
  const notesFiles = formData.getAll("notes_file").filter((f): f is File => f instanceof File);
  try {
    for (const file of notesFiles) {
      assertAllowedUpload(file, { allowedExtensions: NOTES_EXTENSIONS, maxBytes: NOTES_MAX_BYTES });
      const buffer = Buffer.from(await file.arrayBuffer());
      notesParts.push(await extractRawText({ kind: "file", buffer, fileName: file.name }));
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const notes = notesParts.join("\n\n---\n\n").trim() || null;

  if (sections.length === 0 && !notes) {
    return NextResponse.json(
      {
        error:
          "Nothing to build from — select at least one lecture with content, or add some notes.",
      },
      { status: 400 }
    );
  }

  const usage = await recordGeminiCallAndCheckLimit(userId);
  if (!usage.allowed) {
    return NextResponse.json({ error: geminiUsageLimitMessage(usage.limit) }, { status: 429 });
  }

  let generated: Awaited<ReturnType<typeof generateStudyGuide>>;
  try {
    generated = await generateStudyGuide({ sections, focus: focus?.trim() || null, notes });
  } catch (err) {
    await refundGeminiCall(userId, usage.date);
    throw err;
  }
  const { content, usedMock } = generated;

  const defaultTitle =
    sections.length === 1
      ? `Study guide — ${sections[0].label}`
      : sections.length > 1
        ? `Study guide — ${sections.length} lectures`
        : "Study guide — from notes";

  const guide = await prisma.study_guides.create({
    data: {
      user_id: userId,
      title: title?.trim() || defaultTitle,
      focus: focus?.trim() || null,
      notes,
      content,
      used_mock: usedMock,
      sources: {
        create: sections.map((section) => ({
          lecture_id: section.lectureId,
          included_topics: section.includedTopics,
          included_slides: section.includedSlides,
          included_transcript: section.includedTranscript,
          included_notes: section.includedNotes,
        })),
      },
    },
    include: STUDY_GUIDE_DETAIL_INCLUDE,
  });

  return NextResponse.json(serializeStudyGuide(guide), { status: 201 });
}
