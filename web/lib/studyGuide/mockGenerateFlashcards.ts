// Local, offline stand-in for generateFlashcards() when GEMINI_API_KEY isn't
// set — mirrors mockGenerateStudyGuide.ts. Not a real synthesis, just a
// handful of placeholder cards so the pipeline (generate -> persist -> view
// -> flip through) can be exercised without an API key.

import type { Flashcard } from "./schema";

export function mockGenerateFlashcards(studyGuideTitle: string): Flashcard[] {
  return [
    {
      front: `(Locally generated — no GEMINI_API_KEY set) What is this flashcard set for?`,
      back: studyGuideTitle,
    },
  ];
}
