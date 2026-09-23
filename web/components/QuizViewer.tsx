"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/types";
import { stripInlineMarkdown } from "@/lib/studyGuide/plainText";

export function QuizViewer({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) return <p className="muted">No questions yet.</p>;

  function restart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    return (
      <div>
        <p>
          You scored <strong>{score}</strong> out of {questions.length}.
        </p>
        <button type="button" className="secondary" onClick={restart}>
          Retake quiz
        </button>
      </div>
    );
  }

  const question = questions[index];

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correct_index) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        Question {index + 1} of {questions.length}
      </p>
      <p style={{ fontWeight: 600 }}>{stripInlineMarkdown(question.question)}</p>
      <div className="quiz-options">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct_index;
          const isPicked = i === selected;
          const stateClass =
            selected === null
              ? ""
              : isCorrect
                ? " quiz-option-correct"
                : isPicked
                  ? " quiz-option-incorrect"
                  : "";
          return (
            <button
              key={i}
              type="button"
              className={`quiz-option${stateClass}`}
              onClick={() => choose(i)}
              disabled={selected !== null}
            >
              {stripInlineMarkdown(option)}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <>
          <div className="quiz-explanation">
            <strong>{selected === question.correct_index ? "Correct." : "Not quite."}</strong>{" "}
            {stripInlineMarkdown(question.explanation)}
          </div>
          <button type="button" onClick={next} style={{ marginTop: "0.75rem" }}>
            {index + 1 >= questions.length ? "See results" : "Next question"}
          </button>
        </>
      )}
    </div>
  );
}
