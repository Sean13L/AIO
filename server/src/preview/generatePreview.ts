import Anthropic from "@anthropic-ai/sdk";
import { mockGeneratePreview } from "./mockGeneratePreview.js";

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
}

export async function generatePreview({
  courseCode,
  topics,
  slidesText,
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5",
}: GeneratePreviewInput): Promise<string> {
  if (!apiKey) {
    console.warn(
      "[generatePreview] ANTHROPIC_API_KEY is not set — falling back to the " +
        "local mock preview generator (mockGeneratePreview.ts)."
    );
    return mockGeneratePreview({ courseCode, topics, slidesText });
  }

  const client = new Anthropic({ apiKey });

  const userContent = [
    `Course: ${courseCode}`,
    topics
      ? `Syllabus-stated topics for this session: ${topics}`
      : "No syllabus topic description is available for this session.",
    slidesText
      ? `Actual slide content for this session:\n\n${slidesText}`
      : "Slides have not been uploaded yet for this session.",
  ].join("\n\n");

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  if (!textBlock) {
    throw new Error("Claude did not return a text block for the lecture preview");
  }

  return textBlock.text;
}
