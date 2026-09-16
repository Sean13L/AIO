import type { ItemStatus, ItemType, PreviewStatus } from "./types";

// Maps each category value to one of the `.tag-*` color classes in
// globals.css. Centralized so item-type coloring stays consistent across
// the course detail table, board cards, and timeline — instead of each
// page inventing its own mapping.
export const ITEM_TYPE_TAG: Record<ItemType, string> = {
  assignment: "tag-blue",
  quiz: "tag-teal",
  midterm: "tag-amber",
  final_exam: "tag-rose",
  project: "tag-violet",
  peer_evaluation: "tag-pink",
  other: "tag-slate",
};

export const STATUS_TAG: Record<ItemStatus, string> = {
  not_started: "tag-slate",
  in_progress: "tag-amber",
  done: "tag-green",
};

export const PREVIEW_STATUS_TAG: Record<PreviewStatus, string> = {
  not_generated: "tag-slate",
  generated: "tag-blue",
  viewed: "tag-green",
};

const TYPE_LABELS: Record<ItemType, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  midterm: "Midterm",
  final_exam: "Final exam",
  project: "Project",
  peer_evaluation: "Peer evaluation",
  other: "Other",
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export function itemTypeLabel(type: ItemType): string {
  return TYPE_LABELS[type];
}

export function itemStatusLabel(status: ItemStatus): string {
  return STATUS_LABELS[status];
}

// Deterministic per-course color, used purely as a scanning aid across
// multiple courses (dashboard list, course header, board cards) — distinct
// from ITEM_TYPE_TAG/STATUS_TAG, which color by category rather than course.
// Same course code always maps to the same color, with no color persisted
// in the database.
const COURSE_ACCENT_KEYS = [
  "blue",
  "teal",
  "amber",
  "rose",
  "violet",
  "pink",
  "green",
  "slate",
] as const;

export type CourseAccentKey = (typeof COURSE_ACCENT_KEYS)[number];

export function courseAccentKey(courseCode: string): CourseAccentKey {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = (hash * 31 + courseCode.charCodeAt(i)) >>> 0;
  }
  return COURSE_ACCENT_KEYS[hash % COURSE_ACCENT_KEYS.length];
}

export function courseInitials(courseCode: string): string {
  const letters = courseCode.match(/[A-Za-z]+/)?.[0] ?? courseCode;
  return letters.slice(0, 2).toUpperCase();
}
