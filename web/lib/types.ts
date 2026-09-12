export type ItemType =
  | "assignment"
  | "quiz"
  | "midterm"
  | "final_exam"
  | "project"
  | "peer_evaluation"
  | "other";

export type ItemStatus = "not_started" | "in_progress" | "done";

export const ITEM_TYPES: ItemType[] = [
  "assignment",
  "quiz",
  "midterm",
  "final_exam",
  "project",
  "peer_evaluation",
  "other",
];

export const ITEM_STATUSES: ItemStatus[] = ["not_started", "in_progress", "done"];

export interface Course {
  id: string;
  course_code: string;
  course_name: string;
  semester: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  course_id: string;
  name: string;
  type: ItemType;
  due_at: string;
  is_datetime: boolean;
  weight: string | null;
  notes: string | null;
  status: ItemStatus;
  source: "extracted" | "manual";
  created_at: string;
}

export interface ItemWithCourse extends Item {
  course_code: string;
  course_name: string;
}

export type SyncTargetType = "ics_subscriber" | "google_oauth";

export interface CalendarSyncTarget {
  id: string;
  feed_id: string;
  target_type: SyncTargetType;
  label: string | null;
  created_at: string;
}

export type PreviewStatus = "not_generated" | "generated" | "viewed";

export interface Lecture {
  id: string;
  course_id: string;
  scheduled_at: string;
  week_number: number | null;
  topics: string | null;
  slides_url: string | null;
  preview_status: PreviewStatus;
  preview_content: string | null;
  created_at: string;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface Extracurricular {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
}
