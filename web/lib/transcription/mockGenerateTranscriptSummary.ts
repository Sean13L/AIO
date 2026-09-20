// Local, offline stand-in for generateTranscriptSummary() when
// GEMINI_API_KEY isn't set — mirrors mockGeneratePreview.ts. Not a real
// synthesis, just enough to exercise the pipeline (record -> save -> summarize
// -> persist -> view) without an API key.

export interface MockGenerateTranscriptSummaryInput {
  courseCode: string;
  transcript: string;
}

const TRANSCRIPT_SNIPPET_LENGTH = 600;

export function mockGenerateTranscriptSummary({
  courseCode,
  transcript,
}: MockGenerateTranscriptSummaryInput): string {
  const trimmed = transcript.trim();
  const snippet = trimmed.slice(0, TRANSCRIPT_SNIPPET_LENGTH);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  return [
    `Lecture summary for ${courseCode} (locally generated — no GEMINI_API_KEY set).`,
    "",
    `Transcript is ~${wordCount} words. First part of it:`,
    snippet + (trimmed.length > TRANSCRIPT_SNIPPET_LENGTH ? "…" : ""),
  ].join("\n");
}
