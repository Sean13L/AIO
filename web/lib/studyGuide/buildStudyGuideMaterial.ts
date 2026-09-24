import { prisma } from "../prisma";
import { downloadFile, filenameFromFileUrl } from "../storage";
import { extractRawText } from "../extraction/parseFile";
import type { StudyGuideLectureSelection } from "../types";

export interface StudyGuideMaterialSection {
  lectureId: string;
  label: string;
  text: string;
  includedTopics: boolean;
  includedSlides: boolean;
  includedTranscript: boolean;
  includedNotes: boolean;
}

export interface StudyGuideMaterial {
  sections: StudyGuideMaterialSection[];
  // Lecture ids the caller asked for that either don't exist or aren't
  // owned by this user — dropped silently rather than erroring, so a stale
  // selection (e.g. a lecture deleted mid-pick) doesn't block the rest.
  skippedLectureIds: string[];
}

// Gathers the actual study material for each selected lecture — the same
// "richest available source" material the pre-lecture preview and
// transcript summary already draw from (syllabus topics, uploaded slide
// text, transcript/its AI summary) — scoped per lecture to just the content
// types the caller asked to include. Ownership-checked via the courses
// relation, same pattern as every other lecture-scoped route.
export async function buildStudyGuideMaterial(
  userId: string,
  selections: StudyGuideLectureSelection[]
): Promise<StudyGuideMaterial> {
  const lectures = await prisma.lectures.findMany({
    where: {
      id: { in: selections.map((s) => s.lecture_id) },
      courses: { user_id: userId },
    },
    include: { courses: { select: { course_code: true } } },
  });
  const lectureById = new Map(lectures.map((l) => [l.id, l]));

  const sections: StudyGuideMaterialSection[] = [];
  const skippedLectureIds: string[] = [];

  for (const selection of selections) {
    const lecture = lectureById.get(selection.lecture_id);
    if (!lecture) {
      skippedLectureIds.push(selection.lecture_id);
      continue;
    }

    const parts: string[] = [];
    let includedTopics = false;
    let includedSlides = false;
    let includedTranscript = false;
    let includedNotes = false;

    if (selection.include_topics && lecture.topics) {
      parts.push(`Syllabus topics: ${lecture.topics}`);
      includedTopics = true;
    }

    if (selection.include_slides && lecture.slides_url) {
      const filename = filenameFromFileUrl(lecture.slides_url);
      const buffer = filename ? await downloadFile("lectures", filename) : null;
      if (buffer && filename) {
        const slidesText = await extractRawText({ kind: "file", buffer, fileName: filename });
        parts.push(`Slide content:\n${slidesText}`);
        includedSlides = true;
      }
    }

    if (selection.include_transcript) {
      // Prefer the already-condensed summary over the raw transcript when
      // both exist, to keep the combined prompt shorter — same tradeoff
      // generatePreview.ts makes preferring slides over the bare topic list.
      if (lecture.transcript_summary) {
        parts.push(`Lecture summary:\n${lecture.transcript_summary}`);
        includedTranscript = true;
      } else if (lecture.transcript) {
        parts.push(`Lecture transcript:\n${lecture.transcript}`);
        includedTranscript = true;
      }
    }

    // The student's own notes for this specific lecture — kept inside this
    // lecture's section (not the guide-wide notes section) so the model
    // knows which session they belong to.
    if (selection.include_notes && lecture.notes?.trim()) {
      parts.push(`Student's own notes for this lecture:\n${lecture.notes.trim()}`);
      includedNotes = true;
    }

    if (parts.length === 0) continue;

    const label = `${lecture.courses.course_code}${lecture.week_number ? ` — Week ${lecture.week_number}` : ""} (${lecture.scheduled_at.toISOString().slice(0, 10)})`;
    sections.push({
      lectureId: lecture.id,
      label,
      text: parts.join("\n\n"),
      includedTopics,
      includedSlides,
      includedTranscript,
      includedNotes,
    });
  }

  return { sections, skippedLectureIds };
}
