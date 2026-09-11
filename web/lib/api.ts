import type {
  CalendarSyncTarget,
  Course,
  Item,
  ItemStatus,
  ItemType,
  ItemWithCourse,
  Lecture,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(email: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": email,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : JSON.stringify(body.error ?? res.statusText);
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CourseInput {
  course_code: string;
  course_name: string;
  semester: string | null;
}

export interface ItemCreateInput {
  name: string;
  type: ItemType;
  due_date: string;
  due_time: string | null;
  weight: string | null;
  notes: string | null;
}

export interface ItemUpdateInput {
  name?: string;
  type?: ItemType;
  due_date?: string;
  due_time?: string | null;
  weight?: string | null;
  notes?: string | null;
  status?: ItemStatus;
}

export const api = {
  listCourses: (email: string) => request<Course[]>(email, "/api/courses"),

  createCourse: (email: string, input: CourseInput) =>
    request<Course>(email, "/api/courses", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getCourse: (email: string, courseId: string) =>
    request<Course>(email, `/api/courses/${courseId}`),

  deleteCourse: (email: string, courseId: string) =>
    request<void>(email, `/api/courses/${courseId}`, { method: "DELETE" }),

  listItems: (email: string, courseId: string) =>
    request<Item[]>(email, `/api/courses/${courseId}/items`),

  listAllItems: (email: string) => request<ItemWithCourse[]>(email, "/api/items"),

  createItem: (email: string, courseId: string, input: ItemCreateInput) =>
    request<Item>(email, `/api/courses/${courseId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateItem: (email: string, itemId: string, update: ItemUpdateInput) =>
    request<Item>(email, `/api/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  deleteItem: (email: string, itemId: string) =>
    request<void>(email, `/api/items/${itemId}`, { method: "DELETE" }),

  getCalendarFeed: (email: string) =>
    request<{ url: string }>(email, "/api/calendar-feed"),

  listLectures: (email: string, courseId: string) =>
    request<Lecture[]>(email, `/api/courses/${courseId}/lectures`),

  getLecture: (email: string, lectureId: string) =>
    request<Lecture>(email, `/api/lectures/${lectureId}`),

  generateLecturePreview: (email: string, lectureId: string) =>
    request<Lecture>(email, `/api/lectures/${lectureId}/generate-preview`, {
      method: "POST",
    }),

  // Bypasses the shared `request()` helper: file uploads need the browser
  // to set its own multipart Content-Type boundary, not our JSON default.
  uploadLectureSlides: async (email: string, lectureId: string, file: File): Promise<Lecture> => {
    const formData = new FormData();
    formData.append("slides", file);

    const res = await fetch(`${API_URL}/api/lectures/${lectureId}/slides`, {
      method: "POST",
      headers: { "X-User-Email": email },
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Slide upload failed");
    }
    return res.json();
  },

  listSyncTargets: (email: string) =>
    request<CalendarSyncTarget[]>(email, "/api/calendar-feed/sync-targets"),

  addSyncTarget: (email: string, label: string) =>
    request<CalendarSyncTarget>(email, "/api/calendar-feed/sync-targets", {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  removeSyncTarget: (email: string, targetId: string) =>
    request<void>(email, `/api/calendar-feed/sync-targets/${targetId}`, {
      method: "DELETE",
    }),
};
