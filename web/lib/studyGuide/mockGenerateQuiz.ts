// Local, offline stand-in for generateQuiz() when GEMINI_API_KEY isn't set —
// mirrors mockGenerateFlashcards.ts. Not a real synthesis, just a single
// placeholder question so the pipeline can be exercised without an API key.

import type { QuizQuestion } from "./schema";

export function mockGenerateQuiz(studyGuideTitle: string): QuizQuestion[] {
  return [
    {
      question: `(Locally generated — no GEMINI_API_KEY set) Which study guide is this quiz for?`,
      options: [studyGuideTitle, "A different study guide", "None of them", "Not sure"],
      correct_index: 0,
      explanation: "No AI key is configured, so this is a placeholder question, not a real quiz.",
    },
  ];
}
