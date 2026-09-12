import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lectureUploadsDir } from "@/lib/preview/readSlidesText";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `lecture-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
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
    expect(uploaded.slides_url).toMatch(/\/uploads\/lectures\//);

    const generated2 = await generate(new NextRequest("http://localhost/api/lectures/x", { method: "POST" }), {
      params: Promise.resolve({ id: lecture.id }),
    });
    const body2 = await generated2.json();
    expect(body2.preview_content).toContain("accumulators");
    expect(body2.preview_content).not.toContain("No slides uploaded yet");

    const uploadedFile = uploaded.slides_url.split("/").pop();
    fs.unlinkSync(path.join(lectureUploadsDir, uploadedFile));
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
