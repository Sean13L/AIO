"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { api } from "@/lib/api";
import { formatDue, monthLabel } from "@/lib/dates";
import { ITEM_STATUSES, type ItemStatus, type ItemWithCourse } from "@/lib/types";

export default function TimelinePage() {
  const { email, ready } = useCurrentUser();
  const [items, setItems] = useState<ItemWithCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!email) return;
    try {
      setError(null);
      const data = await api.listAllItems(email);
      setItems([...data].sort((a, b) => a.due_at.localeCompare(b.due_at)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function handleStatusChange(item: ItemWithCourse, status: ItemStatus) {
    if (!email) return;
    try {
      await api.updateItem(email, item.id, { status });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) return null;
  if (!email) {
    return (
      <div className="card">
        <p>Enter your email above to see your timeline.</p>
      </div>
    );
  }

  if (items === null) return <p className="muted">Loading…</p>;

  if (items.length === 0) {
    return (
      <div>
        <h1>Timeline</h1>
        <p className="muted">No deadlines yet — add items from a course page.</p>
      </div>
    );
  }

  const groups: { label: string; items: ItemWithCourse[] }[] = [];
  for (const item of items) {
    const label = monthLabel(item.due_at);
    const group = groups[groups.length - 1];
    if (group && group.label === label) {
      group.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return (
    <div>
      <h1>Timeline</h1>
      <p className="muted">All deadlines across every course, by due date.</p>
      {error && <p className="error">{error}</p>}

      {groups.map((group) => (
        <div key={group.label} className="card">
          <h2>{group.label}</h2>
          <table>
            <thead>
              <tr>
                <th>Due</th>
                <th>Course</th>
                <th>Item</th>
                <th>Type</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDue(item)}</td>
                  <td>
                    <Link href={`/courses/${item.course_id}`}>{item.course_code}</Link>
                  </td>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
