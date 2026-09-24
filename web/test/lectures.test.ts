import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `lecture-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

// Force the mock preview generator regardless of whether the developer's
// local .env has a real GEMINI_API_KEY (expected now that we tell users to
// add one for real dev-server testing) — this suite asserts the offline
// mock's specific wording, and must not make slow/costly real network calls.
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// Stub file storage out with an in-memory store so these tests don't need
// real R2 credentials or local disk.
const mockFiles = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(async (namespace: string, buffer: Buffer, filename: string) => {
    mockFiles.set(`${namespace}/${filename}`, buffer);
    return { filename, url: `http://storage.test/files/${namespace}/${filename}` };
  }),
  downloadFile: vi.fn(async (namespace: string, filename: string) => {
    return mockFiles.get(`${namespace}/${filename}`) ?? null;
  }),
  deleteFile: vi.fn(async (namespace: string, filename: string) => {
    mockFiles.delete(`${namespace}/${filename}`);
  }),
  filenameFromFileUrl: (fileUrl: string | null) => (fileUrl ? fileUrl.split("/").pop()! : null),
}));

describe.skipIf(!hasDb)("Lectures API routes (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("generates a preview from topics alone, then a richer one once slides are uploaded", async () => {
    const course = await prisma.courses.create({
      data: {
        user_id: mockSession.userId,
        course_code: "CS135",
        course_name: "Designing Functional Programs",
        semester: "1A",
      },
    });
    const lecture = await prisma.lectures.create({
      data: {
        course_id: course.id,
        scheduled_at: new Date("2026-09-08T14:00:00Z"),
        week_number: 1,
        topics: "Introduction to recursion and base cases.",
      },
    });

    const { GET } = await import("@/app/api/lectures/[id]/route");
    const { POST: uploadSlides } = await import("@/app/api/lectures/[id]/slides/route");
    const { POST: generate } = await import("@/app/api/lectures/[id]/generate-preview/route");

    const initial = await GET(new NextRequest("http://localhost/api/lectures/x"), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(initial.status).toBe(200);
    expect((await initial.json()).preview_status).toBe("not_generated");

    const generated1 = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(generated1.status).toBe(200);
    const body1 = await generated1.json();
    expect(body1.preview_status).toBe("generated");
    expect(body1.preview_content).toContain("recursion");
    expect(body1.preview_content).toContain("No slides uploaded yet");

    const viewed = await GET(new NextRequest("http://localhost/api/lectures/x"), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect((await viewed.json()).preview_status).toBe("viewed");

    const formData = new FormData();
    formData.append(
      "slides",
      new File(
        ["Today: recursion base cases, structural induction, accumulators."],
        "slides.txt",
        { type: "text/plain" }
      )
    );
    const uploadReq = new NextRequest("http://localhost/api/lectures/x/slides", {
      method: "POST",
      body: formData,
    });
    const uploadRes = await uploadSlides(uploadReq, { params: Promise.resolve({ id: lecture.id }) });
    expect(uploadRes.status).toBe(200);
    const uploaded = await uploadRes.json();
    expect(uploaded.slides_url).toMatch(/\/files\/lectures\//);

    const generated2 = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: lecture.id }),
    });
    const body2 = await generated2.json();
    expect(body2.preview_content).toContain("accumulators");
    expect(body2.preview_content).not.toContain("No slides uploaded yet");

    await prisma.courses.delete({ where: { id: course.id } });
  });

  it("saves a transcript via PATCH, then generates a summary from it (mock extractor)", async () => {
    const course = await prisma.courses.create({
      data: {
        user_id: mockSession.userId,
        course_code: "CS246",
        course_name: "Object-Oriented Software Development",
        semester: "1B",
      },
    });
    const lecture = await prisma.lectures.create({
      data: { course_id: course.id, scheduled_at: new Date("2026-09-08T14:00:00Z"), week_number: 1 },
    });

    const { PATCH } = await import("@/app/api/lectures/[id]/route");
    const { POST: generateSummary } = await import(
      "@/app/api/lectures/[id]/generate-summary/route"
    );

    // No transcript yet -> 400, not a crash.
    const tooEarly = await generateSummary(
      new NextRequest("http://localhost/api/lectures/x/generate-summary", { method: "POST" }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect(tooEarly.status).toBe(400);

    const patchReq = new NextRequest("http://localhost/api/lectures/x", {
      method: "PATCH",
      body: JSON.stringify({ transcript: "Today we covered smart pointers and RAII in depth." }),
    });
    const patched = await PATCH(patchReq, { params: Promise.resolve({ id: lecture.id }) });
    expect(patched.status).toBe(200);
    const patchedBody = await patched.json();
    expect(patchedBody.transcript).toContain("smart pointers");

    const summarized = await generateSummary(
      new NextRequest("http://localhost/api/lectures/x/generate-summary", { method: "POST" }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect(summarized.status).toBe(200);
    const summaryBody = await summarized.json();
    expect(summaryBody.usedMock).toBe(true);
    expect(summaryBody.transcript_summary).toContain("CS246");

    // Editing the transcript again invalidates the stale summary.
    const repatched = await PATCH(
      new NextRequest("http://localhost/api/lectures/x", {
        method: "PATCH",
        body: JSON.stringify({ transcript: "A different transcript entirely." }),
      }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect((await repatched.json()).transcript_summary).toBeNull();

    // Clearing (null) is valid too, and 404s stay scoped to the owner.
    const cleared = await PATCH(
      new NextRequest("http://localhost/api/lectures/x", {
        method: "PATCH",
        body: JSON.stringify({ transcript: null }),
      }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect((await cleared.json()).transcript).toBeNull();

    const badBody = await PATCH(
      new NextRequest("http://localhost/api/lectures/x", {
        method: "PATCH",
        body: JSON.stringify({ transcript: 42 }),
      }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect(badBody.status).toBe(400);

    await prisma.courses.delete({ where: { id: course.id } });
  });

  it("429s once the daily Gemini cap is hit, and resumes fresh for a different user", async () => {
    vi.stubEnv("GEMINI_DAILY_LIMIT", "1");
    const cappedUser = await prisma.user.create({
      data: { email: `lecture-test-capped-${Date.now()}@example.com` },
    });
    const course = await prisma.courses.create({
      data: { user_id: cappedUser.id, course_code: "CAP101", course_name: "Capped Course" },
    });
    const lecture1 = await prisma.lectures.create({
      data: { course_id: course.id, scheduled_at: new Date("2026-09-08T14:00:00Z"), week_number: 1 },
    });
    const lecture2 = await prisma.lectures.create({
      data: { course_id: course.id, scheduled_at: new Date("2026-09-10T14:00:00Z"), week_number: 1 },
    });

    const originalUserId = mockSession.userId;
    mockSession.userId = cappedUser.id;

    const { POST: generate } = await import("@/app/api/lectures/[id]/generate-preview/route");

    const first = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: lecture1.id }),
    });
    expect(first.status).toBe(200);

    // A different lecture, same user — the cap is a shared daily budget
    // across all Gemini-backed endpoints/lectures, not per-lecture.
    const second = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: lecture2.id }),
    });
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/Daily AI usage limit reached/);

    // A different user isn't affected by the first user's cap — a fresh
    // user, not the suite's shared mockSession.userId, since that one may
    // already have accumulated usage today from earlier tests in this file.
    const uncappedUser = await prisma.user.create({
      data: { email: `lecture-test-uncapped-${Date.now()}@example.com` },
    });
    mockSession.userId = uncappedUser.id;
    const unaffectedCourse = await prisma.courses.create({
      data: { user_id: uncappedUser.id, course_code: "CAP102", course_name: "Unaffected Course" },
    });
    const unaffectedLecture = await prisma.lectures.create({
      data: { course_id: unaffectedCourse.id, scheduled_at: new Date("2026-09-08T14:00:00Z") },
    });
    const third = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: unaffectedLecture.id }),
    });
    expect(third.status).toBe(200);

    mockSession.userId = originalUserId;
    await prisma.courses.delete({ where: { id: unaffectedCourse.id } });
    await prisma.courses.delete({ where: { id: course.id } });
    await prisma.gemini_usage.deleteMany({ where: { user_id: { in: [cappedUser.id, uncappedUser.id] } } });
    await prisma.user.delete({ where: { id: cappedUser.id } });
    await prisma.user.delete({ where: { id: uncappedUser.id } });
  });

  it("lists all lectures across courses with course_code attached, and 404s for another user", async () => {
    const course1 = await prisma.courses.create({
      data: { user_id: mockSession.userId, course_code: "LIST-A", course_name: "Course A", semester: "1A" },
    });
    const course2 = await prisma.courses.create({
      data: { user_id: mockSession.userId, course_code: "LIST-B", course_name: "Course B", semester: "1A" },
    });
    await prisma.lectures.create({
      data: { course_id: course1.id, scheduled_at: new Date("2026-09-08T14:00:00Z"), week_number: 1 },
    });
    const lecture2 = await prisma.lectures.create({
      data: { course_id: course2.id, scheduled_at: new Date("2026-09-09T14:00:00Z"), week_number: 1 },
    });

    const { GET: listAll } = await import("@/app/api/lectures/route");
    const listRes = await listAll();
    const list = await listRes.json();
    const codes = list.map((l: { course_code: string }) => l.course_code);
    expect(codes).toEqual(expect.arrayContaining(["LIST-A", "LIST-B"]));

    const other = await prisma.user.create({
      data: { email: `lecture-test-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = other.id;

    const { GET: getOne } = await import("@/app/api/lectures/[id]/route");
    const theirRes = await getOne(new NextRequest("http://localhost/api/lectures/x"), {
      params: Promise.resolve({ id: lecture2.id }),
    });
    expect(theirRes.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.user.delete({ where: { id: other.id } });
    await prisma.courses.delete({ where: { id: course1.id } });
    await prisma.courses.delete({ where: { id: course2.id } });
  });

  it("adds a lecture by hand, edits its notes, imports notes from a file, and deletes it", async () => {
    const course = await prisma.courses.create({
      data: { user_id: mockSession.userId, course_code: "MAN101", course_name: "Manual Lectures" },
    });
    const { POST: createLecture } = await import("@/app/api/courses/[id]/lectures/route");
    const { GET, PATCH, DELETE } = await import("@/app/api/lectures/[id]/route");
    const { POST: importNotes } = await import("@/app/api/lectures/[id]/notes/route");
    const jsonReq = (method: string, body: unknown) =>
      new NextRequest("http://localhost/x", { method, body: JSON.stringify(body) });

    // Lectures are always timed, so a missing time is rejected.
    const noTime = await createLecture(jsonReq("POST", { scheduled_date: "2026-10-05" }), {
      params: Promise.resolve({ id: course.id }),
    });
    expect(noTime.status).toBe(400);

    const created = await createLecture(
      jsonReq("POST", {
        scheduled_date: "2026-10-05",
        scheduled_time: "14:30",
        week_number: 5,
        topics: "Makeup session: graph traversal",
      }),
      { params: Promise.resolve({ id: course.id }) }
    );
    expect(created.status).toBe(201);
    const lecture = await created.json();
    expect(lecture.source).toBe("manual");
    expect(lecture.scheduled_at).toBe("2026-10-05T14:30:00.000Z");
    expect(lecture.week_number).toBe(5);

    // Editing notes must NOT wipe an existing transcript summary — only
    // transcript edits invalidate it.
    await prisma.lectures.update({
      where: { id: lecture.id },
      data: { transcript: "t", transcript_summary: "existing summary" },
    });
    const notesRes = await PATCH(jsonReq("PATCH", { notes: "BFS uses a queue." }), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(notesRes.status).toBe(200);
    const withNotes = await notesRes.json();
    expect(withNotes.notes).toBe("BFS uses a queue.");
    expect(withNotes.transcript_summary).toBe("existing summary");

    const empty = await PATCH(jsonReq("PATCH", {}), { params: Promise.resolve({ id: lecture.id }) });
    expect(empty.status).toBe(400);

    // Import appends (with a header naming the file) rather than replacing.
    const form = new FormData();
    form.append("file", new File(["DFS uses a stack."], "dfs.txt", { type: "text/plain" }));
    const imported = await importNotes(
      new NextRequest("http://localhost/x", { method: "POST", body: form }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect(imported.status).toBe(200);
    const afterImport = await imported.json();
    expect(afterImport.notes).toContain("BFS uses a queue.");
    expect(afterImport.notes).toContain("--- Imported from dfs.txt ---");
    expect(afterImport.notes).toContain("DFS uses a stack.");

    const badForm = new FormData();
    badForm.append("file", new File(["<script>"], "notes.html", { type: "text/html" }));
    const badImport = await importNotes(
      new NextRequest("http://localhost/x", { method: "POST", body: badForm }),
      { params: Promise.resolve({ id: lecture.id }) }
    );
    expect(badImport.status).toBe(400);

    // Another user can't delete it.
    const other = await prisma.user.create({
      data: { email: `lecture-test-manual-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = other.id;
    const theirDelete = await DELETE(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(theirDelete.status).toBe(404);
    mockSession.userId = originalUserId;

    const deleted = await DELETE(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(deleted.status).toBe(204);
    const gone = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: lecture.id }),
    });
    expect(gone.status).toBe(404);

    await prisma.user.delete({ where: { id: other.id } });
    await prisma.courses.delete({ where: { id: course.id } });
  }, 20000);
});
