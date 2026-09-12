"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api } from "@/lib/api";
import type { Extracurricular } from "@/lib/types";

export default function ExtracurricularsPage() {
  const { email, ready } = useCurrentUser();
  const [items, setItems] = useState<Extracurricular[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      setItems(await api.listExtracurriculars(email));
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
      await api.createExtracurricular(email, title.trim(), content.trim() || null);
      setTitle("");
      setContent("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: Extracurricular) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content ?? "");
  }

  async function saveEdit(id: string) {
    if (!email) return;
    try {
      await api.updateExtracurricular(email, id, {
        title: editTitle.trim(),
        content: editContent.trim() || null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    if (!email) return;
    if (!confirm("Delete this entry?")) return;
    try {
      await api.deleteExtracurricular(email, id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>Enter your email above to see your extracurriculars.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Extracurriculars</h1>
      <p className="muted">
        Freeform space for side projects and activities outside coursework — not tied to the
        grading/deadline schema.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Add something</h2>
        <form className="inline" onSubmit={handleCreate} style={{ alignItems: "start" }}>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Robotics club"
            />
          </label>
          <label style={{ flex: 1 }}>
            Notes
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              style={{ width: "100%" }}
            />
          </label>
          <button type="submit" disabled={submitting}>
            Add
          </button>
        </form>
      </div>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">Nothing here yet — add a side project or activity above.</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="card">
            {editingId === item.id ? (
              <>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: "100%", marginBottom: "0.5rem", fontWeight: 600 }}
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  style={{ width: "100%", marginBottom: "0.5rem" }}
                />
                <button onClick={() => saveEdit(item.id)}>Save</button>{" "}
                <button className="secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>{item.title}</h3>
                {item.content && <p style={{ whiteSpace: "pre-wrap" }}>{item.content}</p>}
                <button className="secondary" onClick={() => startEdit(item)}>
                  Edit
                </button>{" "}
                <button className="danger" onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
