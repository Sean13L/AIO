// Local, offline stand-in for generateStudyGuide() when GEMINI_API_KEY isn't
// set — mirrors mockGeneratePreview.ts / mockGenerateTranscriptSummary.ts.
// Not a real synthesis, just enough to exercise the pipeline (pick lectures
// -> generate -> persist -> view) without an API key.

import type { StudyGuideMaterialSection } from "./buildStudyGuideMaterial";

const SECTION_SNIPPET_LENGTH = 400;

export interface MockGenerateStudyGuideInput {
  sections: StudyGuideMaterialSection[];
  focus: string | null;
  notes?: string | null;
}

export function mockGenerateStudyGuide({
  sections,
  focus,
  notes,
}: MockGenerateStudyGuideInput): string {
  const lines = ["Study guide (locally generated — no GEMINI_API_KEY set)."];

  if (focus) {
    lines.push("", `Requested focus: ${focus}`);
  }

  for (const section of sections) {
    const trimmed = section.text.trim();
    const snippet = trimmed.slice(0, SECTION_SNIPPET_LENGTH);
    lines.push(
      "",
      `=== ${section.label} ===`,
      snippet + (trimmed.length > SECTION_SNIPPET_LENGTH ? "…" : "")
    );
  }

  if (notes) {
    const trimmed = notes.trim();
    const snippet = trimmed.slice(0, SECTION_SNIPPET_LENGTH);
    lines.push(
      "",
      "=== Student's own notes ===",
      snippet + (trimmed.length > SECTION_SNIPPET_LENGTH ? "…" : "")
    );
  }

  return lines.join("\n");
}
