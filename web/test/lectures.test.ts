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
});
