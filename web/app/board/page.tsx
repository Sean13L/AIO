"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import { formatDue } from "@/lib/dates";
import { ITEM_STATUSES, type ItemStatus, type ItemWithCourse } from "@/lib/types";
import { courseAccentKey, ITEM_TYPE_TAG, itemTypeLabel } from "@/lib/uiColors";

const COLUMN_LABELS: Record<ItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export default function BoardPage() {
  const { email, ready } = useAuthGate();
  const [items, setItems] = useState<ItemWithCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ItemStatus | null>(null);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setItems(await api.listAllItems());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function moveItem(itemId: string, status: ItemStatus) {
    if (!email) return;
    try {
      await api.updateItem(itemId, { status });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>
          <Link href="/auth/signin">Sign in</Link> to see your board.
        </p>
      </div>
    );
  }
  if (items === null) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>Board</h1>
      <p className="muted">Drag a card to a column, or use its status dropdown.</p>
      {error && <p className="error">{error}</p>}

      <div className="board-scroll">
      <div className="board">
        {ITEM_STATUSES.map((status) => (
          <div
            key={status}
            className={`board-column${dragOverColumn === status ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(status);
            }}
            onDragLeave={() => setDragOverColumn((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverColumn(null);
              const itemId = e.dataTransfer.getData("text/plain");
              if (itemId) moveItem(itemId, status);
            }}
          >
            <h2>{COLUMN_LABELS[status]}</h2>
            {items
              .filter((item) => item.status === status)
              .map((item) => (
                <div
                  key={item.id}
                  className="board-card"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
                >
                  <div
                    className="board-card-course"
                    style={{ color: `var(--tag-${courseAccentKey(item.course_code)}-text)` }}
                  >
                    <Link href={`/courses/${item.course_id}`}>{item.course_code}</Link>
                  </div>
                  <div className="board-card-name">{item.name}</div>
                  <span className={`tag ${ITEM_TYPE_TAG[item.type]}`}>
                    {itemTypeLabel(item.type)}
                  </span>
                  <div className="muted" style={{ marginTop: "0.35rem" }}>
                    {formatDue(item)}
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => moveItem(item.id, e.target.value as ItemStatus)}
                  >
                    {ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {COLUMN_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
