"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Todo } from "@/lib/types";
import { formatDue, splitDueAt } from "@/lib/dates";

export default function TodosPage() {
  const { email, ready } = useAuthGate();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [title, setTitle] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [dueTime, setDueTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editHasTime, setEditHasTime] = useState(false);
  const [editDueTime, setEditDueTime] = useState("");

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setTodos(await api.listTodos());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !title.trim()) return;
    if (hasDeadline && !dueDate) return;
    setSubmitting(true);
    try {
      await api.createTodo(
        title.trim(),
        hasDeadline
          ? { due_date: dueDate, due_time: hasTime ? dueTime || "00:00" : null }
          : undefined
      );
      setTitle("");
      setHasDeadline(false);
      setDueDate("");
      setHasTime(false);
      setDueTime("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDone(todo: Todo) {
    if (!email) return;
    try {
      await api.updateTodo(todo.id, { done: !todo.done });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(todoId: string) {
    if (!email) return;
    try {
      await api.deleteTodo(todoId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function startEditDeadline(todo: Todo) {
    if (todo.due_at) {
      const { due_date, due_time } = splitDueAt(todo.due_at, todo.is_datetime);
      setEditDueDate(due_date);
      setEditHasTime(todo.is_datetime);
      setEditDueTime(due_time);
    } else {
      setEditDueDate("");
      setEditHasTime(false);
      setEditDueTime("");
    }
    setEditingId(todo.id);
  }

  async function saveDeadline(todoId: string) {
    if (!email || !editDueDate) return;
    try {
      await api.updateTodo(todoId, {
        due_date: editDueDate,
        due_time: editHasTime ? editDueTime || "00:00" : null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function clearDeadline(todoId: string) {
    if (!email) return;
    try {
      await api.updateTodo(todoId, { due_date: null });
      setEditingId(null);
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
          <Link href="/auth/signin">Sign in</Link> to see your to-do list.
        </p>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div>
      <h1>To Do</h1>
      <p className="muted">
        A lighter, running task list — separate from the structured deadlines on your course
        pages. Add a deadline to any task if you want it to show one, like a reminder — it&apos;s
        entirely optional.
      </p>
      {error && <p className="error">{error}</p>}

      <form className="inline" onSubmit={handleCreate}>
        <label>
          New task
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Email TA about regrade"
          />
        </label>
        <label>
          <span>
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(e) => setHasDeadline(e.target.checked)}
            />{" "}
            Add a deadline
          </span>
        </label>
        {hasDeadline && (
          <>
            <label>
              Date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label>
              <span>
                <input
                  type="checkbox"
                  checked={hasTime}
                  onChange={(e) => setHasTime(e.target.checked)}
                />{" "}
                Specific time
              </span>
              <input
                type="time"
                value={dueTime}
                disabled={!hasTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </label>
          </>
        )}
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {todos === null ? (
        <p className="muted">Loading…</p>
      ) : todos.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            ✅
          </span>
          <h3>Nothing on your list</h3>
          <p>Add a quick task above — this list is separate from your structured deadlines.</p>
        </div>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => {
            const overdue = !todo.done && !!todo.due_at && new Date(todo.due_at).getTime() < now;
            return (
              <li key={todo.id} className={todo.done ? "todo-done" : ""}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
                  <label className="todo-item">
                    <input type="checkbox" checked={todo.done} onChange={() => toggleDone(todo)} />
                    <span>{todo.title}</span>
                  </label>

                  {editingId === todo.id ? (
                    <form
                      className="inline"
                      style={{ margin: "0.3rem 0 0 1.75rem" }}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveDeadline(todo.id);
                      }}
                    >
                      <label>
                        Date
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        <span>
                          <input
                            type="checkbox"
                            checked={editHasTime}
                            onChange={(e) => setEditHasTime(e.target.checked)}
                          />{" "}
                          Specific time
                        </span>
                        <input
                          type="time"
                          value={editDueTime}
                          disabled={!editHasTime}
                          onChange={(e) => setEditDueTime(e.target.value)}
                        />
                      </label>
                      <button type="submit">Save</button>
                      <button type="button" className="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      {todo.due_at && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => clearDeadline(todo.id)}
                        >
                          Remove deadline
                        </button>
                      )}
                    </form>
                  ) : (
                    <div style={{ marginLeft: "1.75rem", display: "flex", gap: "0.6rem" }}>
                      {todo.due_at && (
                        <span className={overdue ? "error" : "muted"}>
                          {overdue ? "Overdue — " : ""}
                          {formatDue({ due_at: todo.due_at, is_datetime: todo.is_datetime })}
                        </span>
                      )}
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: "0 0.3rem", fontSize: "0.8rem" }}
                        onClick={() => startEditDeadline(todo)}
                      >
                        {todo.due_at ? "Edit deadline" : "Set deadline"}
                      </button>
                    </div>
                  )}
                </div>
                <button className="danger" onClick={() => handleDelete(todo.id)}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
