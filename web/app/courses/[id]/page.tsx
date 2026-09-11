"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api, type ItemUpdateInput } from "@/lib/api";
import { ITEM_STATUSES, ITEM_TYPES, type Course, type Item, type ItemStatus, type ItemType } from "@/lib/types";
import { formatDue, splitDueAt } from "@/lib/dates";

interface ItemFormState {
  name: string;
  type: ItemType;
  due_date: string;
  hasTime: boolean;
  due_time: string;
  weight: string;
  notes: string;
}

const emptyForm: ItemFormState = {
  name: "",
  type: "assignment",
  due_date: "",
  hasTime: false,
  due_time: "",
  weight: "",
  notes: "",
};

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params);
  const { email, ready } = useCurrentUser();
  const [course, setCourse] = useState<Course | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(emptyForm);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      const [courseData, itemsData] = await Promise.all([
        api.getCourse(email, courseId),
        api.listItems(email, courseId),
      ]);
      setCourse(courseData);
      setItems(itemsData);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, courseId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !form.name.trim() || !form.due_date) return;
    setSubmitting(true);
    try {
      await api.createItem(email, courseId, {
        name: form.name.trim(),
        type: form.type,
        due_date: form.due_date,
        due_time: form.hasTime ? form.due_time || "00:00" : null,
        weight: form.weight.trim() || null,
        notes: form.notes.trim() || null,
      });
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: Item) {
    const { due_date, due_time } = splitDueAt(item.due_at, item.is_datetime);
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      type: item.type,
      due_date,
      hasTime: item.is_datetime,
      due_time,
      weight: item.weight ?? "",
      notes: item.notes ?? "",
    });
  }

  async function saveEdit(itemId: string) {
    if (!email) return;
    try {
      const update: ItemUpdateInput = {
        name: editForm.name.trim(),
        type: editForm.type,
        due_date: editForm.due_date,
        due_time: editForm.hasTime ? editForm.due_time || "00:00" : null,
        weight: editForm.weight.trim() || null,
        notes: editForm.notes.trim() || null,
      };
      await api.updateItem(email, itemId, update);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleStatusChange(item: Item, status: ItemStatus) {
    if (!email) return;
    try {
      await api.updateItem(email, item.id, { status });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(itemId: string) {
    if (!email) return;
    if (!confirm("Delete this item?")) return;
    try {
      await api.deleteItem(email, itemId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>Enter your email above to view this course.</p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <Link href="/">&larr; All courses</Link>
      </p>
      {error && <p className="error">{error}</p>}

      {course && (
        <h1>
          {course.course_code} — {course.course_name}
          {course.semester && <span className="badge">{course.semester}</span>}
        </h1>
      )}

      <div className="card">
        <h2>Add an item</h2>
        <form className="inline" onSubmit={handleCreate}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Assignment 3"
              required
            />
          </label>
          <label>
            Type
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ItemType }))}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              required
            />
          </label>
          <label>
            <span>
              <input
                type="checkbox"
                checked={form.hasTime}
                onChange={(e) => setForm((f) => ({ ...f, hasTime: e.target.checked }))}
              />{" "}
              Specific time
            </span>
            <input
              type="time"
              value={form.due_time}
              disabled={!form.hasTime}
              onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
            />
          </label>
          <label>
            Weight
            <input
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="15%"
            />
          </label>
          <label>
            Notes
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <button type="submit" disabled={submitting}>
            Add item
          </button>
        </form>
      </div>

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">No items yet — add one above.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Due</th>
              <th>Weight</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) =>
              editingId === item.id ? (
                <tr key={item.id}>
                  <td>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.type}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, type: e.target.value as ItemType }))
                      }
                    >
                      {ITEM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                    />
                    <br />
                    <label>
                      <input
                        type="checkbox"
                        checked={editForm.hasTime}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, hasTime: e.target.checked }))
                        }
                      />{" "}
                      time:
                    </label>
                    <input
                      type="time"
                      value={editForm.due_time}
                      disabled={!editForm.hasTime}
                      onChange={(e) => setEditForm((f) => ({ ...f, due_time: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.weight}
                      onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                    />
                  </td>
                  <td colSpan={2}>
                    <input
                      value={editForm.notes}
                      placeholder="notes"
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </td>
                  <td>
                    <button onClick={() => saveEdit(item.id)}>Save</button>{" "}
                    <button className="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td>{formatDue(item)}</td>
                  <td>{item.weight ?? "—"}</td>
                  <td>
                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item, e.target.value as ItemStatus)}
                    >
                      {ITEM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="badge">{item.source}</span>
                  </td>
                  <td>
                    <button className="secondary" onClick={() => startEdit(item)}>
                      Edit
                    </button>{" "}
                    <button className="danger" onClick={() => handleDelete(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
