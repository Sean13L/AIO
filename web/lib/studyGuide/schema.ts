import { z } from "zod";

export const flashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
});

export const flashcardSetSchema = z.object({
  cards: z.array(flashcardSchema),
});

export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  // 0-based index into `options`.
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const quizSchema = z.object({
  questions: z.array(quizQuestionSchema),
});

export type Flashcard = z.infer<typeof flashcardSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
