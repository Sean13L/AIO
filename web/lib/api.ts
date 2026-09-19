import type {
  CalendarSyncTarget,
  Course,
  Extracurricular,
  Item,
  ItemStatus,
  ItemType,
  ItemWithCourse,
  Lecture,
  LectureWithCourse,
  Todo,
} from "./types";

// Same-origin relative paths now that the API lives in this Next.js app —
// the session cookie rides along automatically, no more manually-typed
// email / X-User-Email header.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  listCourses: () => request<Course[]>("/api/courses"),

  createCourse: (input: CourseInput) =>
    request<Course>("/api/courses", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getCourse: (courseId: string) => request<Course>(`/api/courses/${courseId}`),

  deleteCourse: (courseId: string) =>
    request<void>(`/api/courses/${courseId}`, { method: "DELETE" }),

  listItems: (courseId: string) => request<Item[]>(`/api/courses/${courseId}/items`),

  listAllItems: () => request<ItemWithCourse[]>("/api/items"),

  createItem: (courseId: string, input: ItemCreateInput) =>
    request<Item>(`/api/courses/${courseId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateItem: (itemId: string, update: ItemUpdateInput) =>
    request<Item>(`/api/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  deleteItem: (itemId: string) => request<void>(`/api/items/${itemId}`, { method: "DELETE" }),

  getCalendarFeed: () => request<{ url: string }>("/api/calendar-feed"),

  listLectures: (courseId: string) => request<Lecture[]>(`/api/courses/${courseId}/lectures`),

  listAllLectures: () => request<LectureWithCourse[]>("/api/lectures"),

  getLecture: (lectureId: string) => request<Lecture>(`/api/lectures/${lectureId}`),

  generateLecturePreview: (lectureId: string) =>
    request<Lecture>(`/api/lectures/${lectureId}/generate-preview`, { method: "POST" }),

  // Bypasses the shared `request()` helper: file uploads need the browser
  // to set its own multipart Content-Type boundary, not our JSON default.
  uploadLectureSlides: async (lectureId: string, file: File): Promise<Lecture> => {
    const formData = new FormData();
    formData.append("slides", file);

    const res = await fetch(`/api/lectures/${lectureId}/slides`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Slide upload failed");
    }
    return res.json();
  },

  uploadSyllabus: async (
    input: ({ file: File } | { text: string }) & { courseId?: string }
  ): Promise<{
    courseId: string;
    syllabusId: string;
    itemsCreated: number;
    lecturesCreated: number;
    usedMock: boolean;
  }> => {
    const formData = new FormData();
    if ("file" in input) {
      formData.append("file", input.file);
    } else {
      formData.append("text", input.text);
    }
    if (input.courseId) formData.append("course_id", input.courseId);

    const res = await fetch("/api/syllabi", { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(typeof body.error === "string" ? body.error : "Syllabus upload failed");
    }
    return res.json();
  },

  listSyncTargets: () => request<CalendarSyncTarget[]>("/api/calendar-feed/sync-targets"),

  addSyncTarget: (label: string) =>
    request<CalendarSyncTarget>("/api/calendar-feed/sync-targets", {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  removeSyncTarget: (targetId: string) =>
    request<void>(`/api/calendar-feed/sync-targets/${targetId}`, { method: "DELETE" }),

  listTodos: () => request<Todo[]>("/api/todos"),

  createTodo: (
    title: string,
    deadline?: { due_date: string; due_time: string | null; show_on_calendar?: boolean }
  ) =>
    request<Todo>("/api/todos", {
      method: "POST",
      body: JSON.stringify({ title, ...deadline }),
    }),

  updateTodo: (
    todoId: string,
    update: {
      title?: string;
      done?: boolean;
      due_date?: string | null;
      due_time?: string | null;
      show_on_calendar?: boolean;
    }
  ) =>
    request<Todo>(`/api/todos/${todoId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  deleteTodo: (todoId: string) => request<void>(`/api/todos/${todoId}`, { method: "DELETE" }),

  listExtracurriculars: () => request<Extracurricular[]>("/api/extracurriculars"),

  createExtracurricular: (title: string, content: string | null) =>
    request<Extracurricular>("/api/extracurriculars", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),

  updateExtracurricular: (id: string, update: { title?: string; content?: string | null }) =>
    request<Extracurricular>(`/api/extracurriculars/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  deleteExtracurricular: (id: string) =>
    request<void>(`/api/extracurriculars/${id}`, { method: "DELETE" }),
};
