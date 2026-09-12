import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
    expect(process.env.ANTHROPIC_API_KEY).toBeFalsy();

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

    const items = await prisma.items.findMany({ where: { course_id: result.courseId } });
    expect(items.length).toBe(result.itemsCreated);

    await prisma.courses.delete({ where: { id: result.courseId } });
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

  it("400s with neither a file nor text", async () => {
    const { POST } = await import("@/app/api/syllabi/route");
    const res = await POST(
      new NextRequest("http://localhost/api/syllabi", { method: "POST", body: new FormData() })
    );
    expect(res.status).toBe(400);
  });
});
