import type { TimeFormatPreference } from "./timeFormat";

export function splitDueAt(dueAt: string, isDatetime: boolean) {
  const d = new Date(dueAt);
  const due_date = d.toISOString().slice(0, 10);
  const due_time = isDatetime ? d.toISOString().slice(11, 16) : "";
  return { due_date, due_time };
}

// Reformats a 24-hour "HH:MM" string (how due_time/splitDueAt always produce
// it, and how it's stored/extracted throughout the app) per the user's
// Settings > Appearance time-format preference. "24h" is a no-op passthrough.
export function formatTime(hhmm: string, preference: TimeFormatPreference): string {
  if (preference === "24h") return hhmm;
  const [hStr, minute] = hhmm.split(":");
  const hour24 = parseInt(hStr, 10);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

export function formatDue(
  when: { due_at: string; is_datetime: boolean },
  timeFormat: TimeFormatPreference
): string {
  const { due_date, due_time } = splitDueAt(when.due_at, when.is_datetime);
  return when.is_datetime ? `${due_date} at ${formatTime(due_time, timeFormat)}` : `${due_date} (all day)`;
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
