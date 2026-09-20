import { GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../gemini";
import { mockGenerateTranscriptSummary } from "./mockGenerateTranscriptSummary";

const SYSTEM_PROMPT = `You summarize a live lecture transcript for a student who attended (or is
reviewing after the fact). The transcript comes from browser speech-to-text, so expect filler
words, false starts, and occasional misheard words — read through those rather than commenting on
them.

Write a study-friendly summary: the main topics covered, key concepts/definitions worth
remembering, and any announcements, deadlines, or action items the instructor mentioned (office
hours changes, assignment hints, exam info, etc.) called out in their own short section at the
end if there are any — omit that section entirely if nothing like that was said. Write directly
about the lecture content, not about the transcript itself.`;

export interface GenerateTranscriptSummaryInput {
  courseCode: string;
  transcript: string;
  apiKey?: string;
  model?: string;
}

export interface GenerateTranscriptSummaryResult {
  summary: string;
  usedMock: boolean;
}

export async function generateTranscriptSummary({
  courseCode,
  transcript,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
}: GenerateTranscriptSummaryInput): Promise<GenerateTranscriptSummaryResult> {
  if (!apiKey) {
    console.warn(
      "[generateTranscriptSummary] GEMINI_API_KEY is not set — falling back to the " +
        "local mock summarizer (mockGenerateTranscriptSummary.ts)."
    );
    return { summary: mockGenerateTranscriptSummary({ courseCode, transcript }), usedMock: true };
  }

  const client = new GoogleGenAI({ apiKey });

  const response = await generateContentWithFallback(client, {
    model,
    contents: `Course: ${courseCode}\n\nLecture transcript:\n\n${transcript}`,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  if (!response.text) {
    throw new Error("Gemini did not return text for the transcript summary");
  }

  return { summary: response.text, usedMock: false };
}
