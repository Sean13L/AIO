// Local, offline stand-in for generatePreview() when ANTHROPIC_API_KEY isn't
// set — mirrors the mockExtractSyllabus.ts pattern from the extraction
// pipeline. Not a real synthesis, just enough to exercise the pipeline
// (upload slides -> generate -> persist -> view) without an API key.

export interface MockGeneratePreviewInput {
  courseCode: string;
  topics: string | null;
  slidesText: string | null;
}

const SLIDE_SNIPPET_LENGTH = 500;

export function mockGeneratePreview({
  courseCode,
  topics,
  slidesText,
}: MockGeneratePreviewInput): string {
  const lines = [
    `Pre-lecture preview for ${courseCode} (locally generated — no ANTHROPIC_API_KEY set).`,
  ];

  if (topics) {
    lines.push("", `Expected topics from the syllabus: ${topics}`);
  } else {
    lines.push("", "No syllabus topic description is available for this session.");
  }

  if (slidesText) {
    const trimmed = slidesText.trim();
    const snippet = trimmed.slice(0, SLIDE_SNIPPET_LENGTH);
    lines.push(
      "",
      "From the uploaded slides:",
      snippet + (trimmed.length > SLIDE_SNIPPET_LENGTH ? "…" : "")
    );
  } else {
    lines.push(
      "",
      "No slides uploaded yet for this session — this preview is based on the syllabus topic description alone."
    );
  }

  return lines.join("\n");
}
