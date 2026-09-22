"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/types";

export function FlashcardViewer({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (cards.length === 0) return <p className="muted">No cards yet.</p>;
  const card = cards[index];

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + delta)));
    setRevealed(false);
  }

  function toggle() {
    setRevealed((r) => !r);
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: "0.5rem" }}>
        Card {index + 1} of {cards.length}
      </p>
      <div
        className="flashcard"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className="flashcard-label">{revealed ? "Answer" : "Question"}</span>
        <p className="flashcard-text">{revealed ? card.back : card.front}</p>
        <span className="muted flashcard-hint">
          Click to {revealed ? "show the question" : "reveal the answer"}
        </span>
      </div>
      <div className="actions" style={{ marginTop: "0.85rem" }}>
        <button type="button" className="secondary" onClick={() => go(-1)} disabled={index === 0}>
          ← Previous
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
