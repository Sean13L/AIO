import type { Item } from "./types";

export function splitDueAt(dueAt: string, isDatetime: boolean) {
  const d = new Date(dueAt);
  const due_date = d.toISOString().slice(0, 10);
  const due_time = isDatetime ? d.toISOString().slice(11, 16) : "";
  return { due_date, due_time };
}

export function formatDue(item: Item): string {
  const { due_date, due_time } = splitDueAt(item.due_at, item.is_datetime);
  return item.is_datetime ? `${due_date} at ${due_time}` : `${due_date} (all day)`;
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Group label for the timeline view, e.g. "September 2026" — based on the
// UTC calendar date (matches how due_at is stored; see ingestSyllabus.ts).
export function monthLabel(dueAt: string): string {
  const d = new Date(dueAt);
  return `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
