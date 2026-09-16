"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGate } from "@/lib/useAuthGate";
import { api } from "@/lib/api";
import type { Todo } from "@/lib/types";

export default function TodosPage() {
  const { email, ready } = useAuthGate();
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await api.createTodo(title.trim());
      setTitle("");
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

  return (
    <div>
      <h1>To Do</h1>
      <p className="muted">
        A lighter, running task list — separate from the structured deadlines on your course
        pages.
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
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? "todo-done" : ""}>
              <label className="todo-item">
                <input type="checkbox" checked={todo.done} onChange={() => toggleDone(todo)} />
                <span>{todo.title}</span>
              </label>
              <button className="danger" onClick={() => handleDelete(todo.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
