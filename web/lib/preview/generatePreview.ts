import { GoogleGenAI } from "@google/genai";
import { mockGeneratePreview } from "./mockGeneratePreview";
import { generateContentWithFallback } from "../gemini";
import type { GeminiFeature } from "../geminiErrors";

const SYSTEM_PROMPT = `You help a student prepare for an upcoming lecture. Given the syllabus's
stated topics for this session and, if available, the actual slide content, write a short
(150-300 word) pre-lecture primer: what will be covered, key terms/concepts to know going in,
and how it connects to what likely came before in the course.

If slide content is available, lean on it as the actual scope for this session over the
syllabus's topic description. If slides are not available, work from the topic description
alone and say so — don't invent specifics the material doesn't support. Write directly to the
student ("you'll cover...").`;

export interface GeneratePreviewInput {
  courseCode: string;
  topics: string | null;
  slidesText: string | null;
  apiKey?: string;
  model?: string;
  // Who the request is for — stored with any Gemini error so users see
  // their own failures on the AI usage page.
  userId?: string | null;
  // The daily cron passes "lecture_preview_cron" so its failures can be told
  // apart from on-demand generation in gemini_errors.
  feature?: Extract<GeminiFeature, "lecture_preview" | "lecture_preview_cron">;
}

export async function generatePreview({
  courseCode,
  topics,
  slidesText,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  userId = null,
  feature = "lecture_preview",
}: GeneratePreviewInput): Promise<string> {
  if (!apiKey) {
    console.warn(
      "[generatePreview] GEMINI_API_KEY is not set — falling back to the " +
        "local mock preview generator (mockGeneratePreview.ts)."
    );
    return mockGeneratePreview({ courseCode, topics, slidesText });
  }

  const client = new GoogleGenAI({ apiKey });

  const userContent = [
    `Course: ${courseCode}`,
    topics
      ? `Syllabus-stated topics for this session: ${topics}`
      : "No syllabus topic description is available for this session.",
    slidesText
      ? `Actual slide content for this session:\n\n${slidesText}`
      : "Slides have not been uploaded yet for this session.",
  ].join("\n\n");

  const response = await generateContentWithFallback(client, {
    model,
    contents: userContent,
    config: { systemInstruction: SYSTEM_PROMPT },
  }, { feature, userId });

  if (!response.text) {
    throw new Error("Gemini did not return text for the lecture preview");
  }

  return response.text;
}
