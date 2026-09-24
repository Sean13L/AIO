import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `syllabus-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: vi.fn(async (namespace: string, _buffer: Buffer, filename: string) => ({
    filename,
    url: `http://storage.test/files/${namespace}/${filename}`,
  })),
}));

// Force the mock extractor regardless of whether the developer's local .env
// has a real GEMINI_API_KEY (expected now that we tell users to add one for
// real dev-server testing) — these tests assert the offline-mock fallback
// path specifically, and must not make real network calls either way.
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const sampleSyllabus = `CS 135 — Designing Functional Programs
Semester: 1A

Grading:
- Assignments: 30%
- Midterm Exam: 25%
- Final Exam: 45%

Key Dates:
- Assignment 1 due September 20, 2026 (no specific time given).
- Midterm Exam on October 15, 2026 at 2:00 PM.

Weekly Schedule:
- Week 1 (Sept 8): Introduction to Racket, basic recursion. Lecture meets Mondays at 10:00 AM.
`;

describe.skipIf(!hasDb)("Syllabus ingestion API route (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("parses pasted text end-to-end into a course, items, and lectures (no API key -> mock extractor)", async () => {
    expect(process.env.GEMINI_API_KEY).toBeFalsy();

    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append("text", sampleSyllabus);

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result.itemsCreated).toBeGreaterThan(0);
    expect(result.lecturesCreated).toBeGreaterThan(0);
    // No GEMINI_API_KEY in this test env, so extraction fell back to the
    // offline mock — callers (the upload page) need this flag to warn the
    // user rather than silently showing possibly-garbage results.
    expect(result.usedMock).toBe(true);

    const items = await prisma.items.findMany({ where: { course_id: result.courseId } });
    expect(items.length).toBe(result.itemsCreated);

    await prisma.courses.delete({ where: { id: result.courseId } });
  });

  it("attaches to an explicit course_id instead of auto-matching/creating a course", async () => {
    const targetCourse = await prisma.courses.create({
      data: {
        user_id: mockSession.userId,
        course_code: "SOMETHING-ELSE",
        course_name: "Pre-existing course the user picked",
        semester: "9Z",
      },
    });

    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append("text", sampleSyllabus);
    formData.append("course_id", targetCourse.id);

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(201);
    const result = await res.json();
    expect(result.courseId).toBe(targetCourse.id);

    // The explicitly-picked course's own fields are untouched by the
    // syllabus's extracted course_code/name/semester.
    const course = await prisma.courses.findUniqueOrThrow({ where: { id: targetCourse.id } });
    expect(course.course_code).toBe("SOMETHING-ELSE");
    expect(course.semester).toBe("9Z");

    const items = await prisma.items.findMany({ where: { course_id: targetCourse.id } });
    expect(items.length).toBe(result.itemsCreated);

    await prisma.courses.delete({ where: { id: targetCourse.id } });
  });

  it("404s when course_id doesn't belong to the signed-in user", async () => {
    const otherUser = await prisma.user.create({ data: { email: `other-${Date.now()}@example.com` } });
    const otherCourse = await prisma.courses.create({
      data: { user_id: otherUser.id, course_code: "NOTYOURS", course_name: "Not yours" },
    });

    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append("text", sampleSyllabus);
    formData.append("course_id", otherCourse.id);

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(404);

    await prisma.courses.delete({ where: { id: otherCourse.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("archives an uploaded file and stores its URL as file_url", async () => {
    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append("file", new File([sampleSyllabus], "syllabus.txt", { type: "text/plain" }));

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(201);
    const result = await res.json();

    const syllabus = await prisma.syllabi.findUnique({ where: { id: result.syllabusId } });
    expect(syllabus?.file_url).toMatch(/^http:\/\/storage\.test\/files\/syllabi\//);

    await prisma.courses.delete({ where: { id: result.courseId } });
  });

  it("combines multiple uploaded files (and pasted text) into a single course", async () => {
    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append("file", new File([sampleSyllabus], "syllabus.txt", { type: "text/plain" }));
    formData.append(
      "file",
      new File(["Final exam room addendum: DC 1350."], "exam-room-addendum.txt", {
        type: "text/plain",
      })
    );
    formData.append("text", "Office hours moved to Thursdays 3-4pm.");

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(201);
    const result = await res.json();

    const syllabus = await prisma.syllabi.findUnique({ where: { id: result.syllabusId } });
    // Traceability field records every uploaded document's URL, comma-joined
    // — two files went through storage (renamed to a UUID + original
    // extension, per uploadFile's contract), plus the pasted-text placeholder.
    const urls = syllabus?.file_url.split(", ") ?? [];
    expect(urls.length).toBe(3);
    expect(urls.filter((u) => u.startsWith("http://storage.test/files/syllabi/")).length).toBe(2);
    expect(urls.some((u) => u.startsWith("pasted-text:"))).toBe(true);

    await prisma.courses.delete({ where: { id: result.courseId } });
  });

  it("400s with neither a file nor text", async () => {
    const { POST } = await import("@/app/api/syllabi/route");
    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: new FormData() })
    );
    expect(res.status).toBe(400);
  });

  it("refunds the daily AI budget when the upload can't be processed", async () => {
    await prisma.gemini_usage.deleteMany({ where: { user_id: mockSession.userId } });

    const { POST } = await import("@/app/api/syllabi/route");
    const formData = new FormData();
    formData.append(
      "file",
      new File([Buffer.from("%PDF-1.4 this is not really a pdf")], "broken.pdf", {
        type: "application/pdf",
      })
    );

    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: formData })
    );
    expect(res.status).toBe(500);

    const usage = await prisma.gemini_usage.findFirst({ where: { user_id: mockSession.userId } });
    expect(usage?.count ?? 0).toBe(0);
    await prisma.gemini_usage.deleteMany({ where: { user_id: mockSession.userId } });
  });
});
