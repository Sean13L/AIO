import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import {
  syllabusExtractionSchema,
  type SyllabusExtraction,
} from "./schema";
import { mockExtractSyllabus } from "./mockExtractSyllabus";

const TOOL_NAME = "record_syllabus_extraction";

// Hand-written JSON Schema for the extraction tool's input. Kept in sync with
// ./schema.ts by hand — duplicating the shape here is simpler and more
// transparent than deriving it from the zod schema for a schema this size.
// Also doubles as Gemini's `parametersJsonSchema` — both APIs accept plain
// JSON Schema for structured/tool output, so one definition covers both.
const extractionToolInputSchema = {
  type: "object",
  properties: {
    course: {
      type: "object",
      properties: {
        course_code: { type: "string" },
        course_name: { type: "string" },
        semester: { type: ["string", "null"] },
      },
      required: ["course_code", "course_name", "semester"],
    },
    grading_scheme: {
      type: "array",
      items: {
        type: "object",
        properties: {
          component: { type: "string" },
          weight: { type: "string" },
        },
        required: ["component", "weight"],
      },
    },
    policies: {
      type: "object",
      properties: {
        late_work: { type: ["string", "null"] },
        attendance: { type: ["string", "null"] },
        academic_integrity: { type: ["string", "null"] },
        regrade_policy: { type: ["string", "null"] },
        other: { type: ["string", "null"] },
      },
      required: [
        "late_work",
        "attendance",
        "academic_integrity",
        "regrade_policy",
        "other",
      ],
    },
    required_tools: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: {
            type: "string",
            enum: [
              "assignment",
              "quiz",
              "midterm",
              "final_exam",
              "project",
              "peer_evaluation",
              "other",
            ],
          },
          due_date: {
            type: "string",
            description: "YYYY-MM-DD",
          },
          due_time: {
            type: ["string", "null"],
            description:
              "HH:MM 24h, only when the syllabus specifies a real deadline time. Otherwise null.",
          },
          is_datetime: {
            type: "boolean",
            description:
              "true only when due_time is set from an actual syllabus-specified time",
          },
          weight: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
        },
        required: [
          "name",
          "type",
          "due_date",
          "due_time",
          "is_datetime",
          "weight",
          "notes",
        ],
      },
    },
    lectures: {
      type: "array",
      items: {
        type: "object",
        properties: {
          week_number: { type: ["integer", "null"] },
          scheduled_date: { type: "string", description: "YYYY-MM-DD" },
          scheduled_time: { type: "string", description: "HH:MM 24h" },
          topics: { type: ["string", "null"] },
        },
        required: ["week_number", "scheduled_date", "scheduled_time", "topics"],
      },
    },
  },
  required: [
    "course",
    "grading_scheme",
    "policies",
    "required_tools",
    "items",
    "lectures",
  ],
} as const;

// A function, not a constant, so "today" is accurate at request time —
// without an explicit anchor, dates in a syllabus that never states its own
// year (common: "Fall Term", "Week 1 (Sept 3)") get inferred against the
// model's training cutoff instead of the actual current year, landing
// deadlines in the past. Found by testing against a real (unstructured,
// year-less) syllabus.
function systemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You extract structured data from a course syllabus for a student planning tool. Today's date is ${today} — use this to resolve any date in the syllabus that doesn't state an explicit year (e.g. "Week 1 (Sept 3)", "Fall Term"). Assume such dates refer to the current or nearest upcoming occurrence relative to today, never a past year, unless the syllabus text itself states a different year.

Rules:
- due_date/scheduled_date are always required, in YYYY-MM-DD.
- due_time is set (HH:MM, 24h) ONLY when the syllabus states an actual clock time for that deadline (e.g. "quiz at 2:00 PM", "due by 11:59 PM"). If the syllabus only gives a date with no time, due_time must be null and is_datetime must be false. If due_time is set, is_datetime must be true.
- Lectures always have a scheduled_time — infer it from the course's stated class meeting time if the week-by-week schedule doesn't repeat it per row.
- type must be the best-fitting one of: assignment, quiz, midterm, final_exam, project, peer_evaluation, other.
- Weight is free text (e.g. "15%", "5% each"); use null if not stated.
- grading_scheme lists each graded component and its weight as stated in the syllabus.
- required_tools lists textbooks, software, calculators, platforms/LMS the syllabus says are required.
- Do not invent dates, weights, or policies that are not present in the text — use null/empty arrays when the syllabus doesn't say.`;
}

export interface ExtractSyllabusOptions {
  syllabusText: string;
  apiKey?: string;
  model?: string;
}

// Callers need to know when the offline mock stood in for real Gemini
// extraction — it only matches syllabi formatted in one specific way (see
// mockExtractSyllabus.ts) and otherwise produces near-garbage that reads as
// "random" if surfaced silently. See ingestSyllabus.ts / app/upload for
// where this becomes a warning shown to the user.
export interface ExtractSyllabusResult {
  extraction: SyllabusExtraction;
  usedMock: boolean;
}

export async function extractSyllabus({
  syllabusText,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
}: ExtractSyllabusOptions): Promise<ExtractSyllabusResult> {
  if (!apiKey) {
    console.warn(
      "[extractSyllabus] GEMINI_API_KEY is not set — falling back to the " +
        "local heuristic mock extractor (mockExtractSyllabus.ts). This is a " +
        "workaround for running the pipeline without an API key; results " +
        "will be far less accurate than real Gemini extraction."
    );
    return { extraction: mockExtractSyllabus(syllabusText), usedMock: true };
  }

  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model,
    contents: `Here is the syllabus text:\n\n${syllabusText}`,
    config: {
      systemInstruction: systemPrompt(),
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
              description: "Record the structured data extracted from a course syllabus.",
              parametersJsonSchema: extractionToolInputSchema,
            },
          ],
        },
      ],
    },
  });

  const call = response.functionCalls?.[0];
  if (!call?.args) {
    throw new Error("Gemini did not return a function call for extraction");
  }

  return { extraction: syllabusExtractionSchema.parse(call.args), usedMock: false };
}
