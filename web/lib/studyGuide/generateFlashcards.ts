import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../gemini";
import { flashcardSetSchema, type Flashcard } from "./schema";
import { mockGenerateFlashcards } from "./mockGenerateFlashcards";

const TOOL_NAME = "record_flashcards";

const flashcardsToolInputSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: { type: "string", description: "The question/term/prompt side." },
          back: { type: "string", description: "The answer/definition side." },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["cards"],
} as const;

const SYSTEM_PROMPT = `You turn a student's study guide into a set of flashcards for active recall practice.

Rules:
- One concept, term, or fact per card — not whole sections restated.
- The front is a question, term, or prompt; the back is the concise answer/definition. Neither side
  should just quote a full sentence from the source — rephrase for quick recall.
- Cover the material broadly rather than clustering on one section, but skip trivial restatements
  (e.g. don't make separate cards for near-duplicate facts).
- Aim for roughly 10-20 cards depending on how much material is actually here — fewer for a short
  guide, more for a long one. Don't pad with filler cards to hit a number.`;

export interface GenerateFlashcardsResult {
  cards: Flashcard[];
  usedMock: boolean;
}

export async function generateFlashcards({
  studyGuideTitle,
  studyGuideContent,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
}: {
  studyGuideTitle: string;
  studyGuideContent: string;
  apiKey?: string;
  model?: string;
}): Promise<GenerateFlashcardsResult> {
  if (!apiKey) {
    console.warn(
      "[generateFlashcards] GEMINI_API_KEY is not set — falling back to the " +
        "local mock generator (mockGenerateFlashcards.ts)."
    );
    return { cards: mockGenerateFlashcards(studyGuideTitle), usedMock: true };
  }

  const client = new GoogleGenAI({ apiKey });

  const response = await generateContentWithFallback(client, {
    model,
    contents: `Study guide: ${studyGuideTitle}\n\n${studyGuideContent}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [TOOL_NAME],
        },
      },
      tools: [
        {
          functionDeclarations: [
            {
              name: TOOL_NAME,
              description: "Record the generated flashcard set.",
              parametersJsonSchema: flashcardsToolInputSchema,
            },
          ],
        },
      ],
    },
  });

  const call = response.functionCalls?.[0];
  if (!call?.args) {
    throw new Error("Gemini did not return a function call for flashcard generation");
  }

  return { cards: flashcardSetSchema.parse(call.args).cards, usedMock: false };
}
