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
