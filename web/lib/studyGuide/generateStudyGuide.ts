import { GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../gemini";
import { mockGenerateStudyGuide } from "./mockGenerateStudyGuide";
import type { StudyGuideMaterialSection } from "./buildStudyGuideMaterial";

const SYSTEM_PROMPT = `You create a study guide for a student from lecture material they've selected —
syllabus topics, uploaded slide content, and/or lecture transcripts/summaries — across one or more
of their courses. Transcripts and summaries, where present, ultimately come from live speech-to-text
during class, so expect filler words and the occasional misheard term; read through those rather
than commenting on them.

Organize the guide by the lecture sections given (keep their headers), and for each:
- Distill the core concepts, definitions, and facts a student needs to know, in a form suited to
  review — bullet points, bolded terms, not prose paragraphs restating the material.
- Call out anything that reads as exam-relevant or was explicitly emphasized by the instructor
  (e.g. "this will be on the test", assignment hints, formulas to memorize).
- If the same concept recurs across sections, don't repeat the full explanation — note briefly
  where else it's covered and expand it only once.

If the student gave a focus, prioritize material relevant to it, but don't omit other clearly
important content from the sections provided.

End with a short "Key terms" list pulling together the most important vocabulary/definitions from
everything covered, deduplicated.`;

export interface GenerateStudyGuideInput {
  sections: StudyGuideMaterialSection[];
  focus?: string | null;
  apiKey?: string;
  model?: string;
}

export interface GenerateStudyGuideResult {
  content: string;
  usedMock: boolean;
}

export async function generateStudyGuide({
  sections,
  focus = null,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
}: GenerateStudyGuideInput): Promise<GenerateStudyGuideResult> {
  if (!apiKey) {
    console.warn(
      "[generateStudyGuide] GEMINI_API_KEY is not set — falling back to the " +
        "local mock generator (mockGenerateStudyGuide.ts)."
    );
    return { content: mockGenerateStudyGuide({ sections, focus }), usedMock: true };
  }

  const client = new GoogleGenAI({ apiKey });

  const userContent = [
    focus ? `Focus requested by the student: ${focus}` : null,
    ...sections.map((s) => `=== ${s.label} ===\n\n${s.text}`),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  const response = await generateContentWithFallback(client, {
    model,
    contents: userContent,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  if (!response.text) {
    throw new Error("Gemini did not return text for the study guide");
  }

  return { content: response.text, usedMock: false };
}
