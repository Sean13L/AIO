import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "../gemini";
import { quizSchema, type QuizQuestion } from "./schema";
import { mockGenerateQuiz } from "./mockGenerateQuiz";

const TOOL_NAME = "record_quiz";

const quizToolInputSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
            description: "Exactly 4 options, in the order they should be shown.",
          },
          correct_index: {
            type: "integer",
            description: "0-based index into options of the single correct answer.",
          },
          explanation: {
            type: "string",
            description: "Why that answer is correct — shown after the student answers.",
          },
        },
        required: ["question", "options", "correct_index", "explanation"],
      },
    },
  },
  required: ["questions"],
} as const;

const SYSTEM_PROMPT = `You turn a student's study guide into a multiple-choice quiz for self-testing.

Rules:
- Each question tests one concept from the material — not trivia unrelated to it, and not a
  question whose answer is obvious from the wording of the question itself.
- Exactly 4 options per question, exactly one correct. The three wrong options (distractors)
  should be plausible — common misconceptions or easily confused related concepts — not obviously
  wrong filler.
- Vary correct_index across questions — don't put the correct answer in the same position every
  time.
- Write a short explanation for each question, shown after the student answers, that reinforces
  why the correct option is right (and briefly why the others aren't, when that's instructive).
- Aim for roughly 5-10 questions depending on how much material is actually here. Don't pad with
  filler questions to hit a number.
- Write plain text only — no markdown (no **bold**, *italics*, or backticks) in questions, options,
  or explanations. They're displayed as-is, so formatting characters would show up literally.`;

export interface GenerateQuizResult {
  questions: QuizQuestion[];
  usedMock: boolean;
}

export async function generateQuiz({
  studyGuideTitle,
  studyGuideContent,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
}: {
  studyGuideTitle: string;
  studyGuideContent: string;
  apiKey?: string;
  model?: string;
}): Promise<GenerateQuizResult> {
  if (!apiKey) {
    console.warn(
      "[generateQuiz] GEMINI_API_KEY is not set — falling back to the local " +
        "mock generator (mockGenerateQuiz.ts)."
    );
    return { questions: mockGenerateQuiz(studyGuideTitle), usedMock: true };
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
              description: "Record the generated multiple-choice quiz.",
              parametersJsonSchema: quizToolInputSchema,
            },
          ],
        },
      ],
    },
  }, "quiz");

  const call = response.functionCalls?.[0];
  if (!call?.args) {
    throw new Error("Gemini did not return a function call for quiz generation");
  }

  return { questions: quizSchema.parse(call.args).questions, usedMock: false };
}
