import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `study-guide-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

// Mock extractor/generator throughout — asserts the offline mock's specific
// wording and must not make real network calls.
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

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

describe.skipIf(!hasDb)("Study guides API routes (requires DATABASE_URL)", () => {
  let courseId: string;
  let lectureWithTopicsAndSlides: string;
  let lectureWithTranscriptOnly: string;
  let lectureWithNothing: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;

    const course = await prisma.courses.create({
      data: { user_id: user.id, course_code: "SG101", course_name: "Study Guide Test Course" },
    });
    courseId = course.id;

    mockFiles.set(
      "lectures/slides1.txt",
      Buffer.from("Big-O notation, best/worst/average case analysis.")
    );

    const lecture1 = await prisma.lectures.create({
      data: {
        course_id: course.id,
        scheduled_at: new Date("2026-09-08T14:00:00Z"),
        week_number: 1,
        topics: "Introduction to algorithmic complexity.",
        slides_url: "http://storage.test/files/lectures/slides1.txt",
      },
    });
    lectureWithTopicsAndSlides = lecture1.id;

    const lecture2 = await prisma.lectures.create({
      data: {
        course_id: course.id,
        scheduled_at: new Date("2026-09-10T14:00:00Z"),
        week_number: 1,
        transcript: "Today we proved that binary search runs in log n time in the worst case.",
      },
    });
    lectureWithTranscriptOnly = lecture2.id;

    const lecture3 = await prisma.lectures.create({
      data: { course_id: course.id, scheduled_at: new Date("2026-09-15T14:00:00Z"), week_number: 2 },
    });
    lectureWithNothing = lecture3.id;
  });

  afterAll(async () => {
    await prisma.courses.delete({ where: { id: courseId } });
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("400s with no lectures selected (schema validation)", async () => {
    const { POST } = await import("@/app/api/study-guides/route");
    const res = await POST(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({ lectures: [] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s when every selected lecture has no usable content", async () => {
    const { POST } = await import("@/app/api/study-guides/route");
    const res = await POST(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({
          lectures: [
            {
              lecture_id: lectureWithNothing,
              include_topics: true,
              include_slides: true,
              include_transcript: true,
            },
          ],
        }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/any content to include/i);
  });

  it("generates a guide from selected lectures/content, persists sources, and supports get/list/delete", async () => {
    // Several sequential DB round-trips (build material, record usage,
    // create with nested sources, list, get, delete) — the default 5s can
    // be tight under normal latency, let alone Neon under load.
    const { POST } = await import("@/app/api/study-guides/route");
    const createRes = await POST(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({
          title: "Midterm 1 review",
          focus: "definitions",
          lectures: [
            {
              lecture_id: lectureWithTopicsAndSlides,
              include_topics: true,
              include_slides: true,
              // Requesting transcript on a lecture that has none should just
              // be a no-op for that content type, not an error.
              include_transcript: true,
            },
            {
              lecture_id: lectureWithTranscriptOnly,
              include_topics: false,
              include_slides: false,
              include_transcript: true,
            },
            // Not owned by this user — should be silently dropped, not leak
            // as a 404/500.
            {
              lecture_id: "00000000-0000-0000-0000-000000000000",
              include_topics: true,
              include_slides: true,
              include_transcript: true,
            },
          ],
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.title).toBe("Midterm 1 review");
    expect(created.used_mock).toBe(true);
    expect(created.content).toContain("locally generated");
    expect(created.content).toContain("Big-O notation");
    expect(created.content).toContain("binary search");
    expect(created.sources).toHaveLength(2);

    const topicsSource = created.sources.find(
      (s: { lecture_id: string }) => s.lecture_id === lectureWithTopicsAndSlides
    );
    expect(topicsSource).toMatchObject({
      course_code: "SG101",
      included_topics: true,
      included_slides: true,
      included_transcript: false, // nothing to include, even though requested
    });

    const { GET: listGuides } = await import("@/app/api/study-guides/route");
    const listRes = await listGuides();
    const list = await listRes.json();
    const listed = list.find((g: { id: string }) => g.id === created.id);
    expect(listed).toMatchObject({ title: "Midterm 1 review", lecture_count: 2, used_mock: true });

    const { GET: getGuide, DELETE: deleteGuide } = await import("@/app/api/study-guides/[id]/route");
    const getRes = await getGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).content).toBe(created.content);

    const delRes = await deleteGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(delRes.status).toBe(204);

    const afterDelete = await getGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(afterDelete.status).toBe(404);
  }, 20000);

  it("scopes get/delete to the owning user", async () => {
    const { POST } = await import("@/app/api/study-guides/route");
    const createRes = await POST(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({
          lectures: [
            {
              lecture_id: lectureWithTopicsAndSlides,
              include_topics: true,
              include_slides: false,
              include_transcript: false,
            },
          ],
        }),
      })
    );
    const created = await createRes.json();

    const otherUser = await prisma.user.create({
      data: { email: `study-guide-test-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = otherUser.id;

    const { GET: getGuide, DELETE: deleteGuide } = await import("@/app/api/study-guides/[id]/route");
    const theirGet = await getGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(theirGet.status).toBe(404);
    const theirDelete = await deleteGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(theirDelete.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.study_guides.deleteMany({ where: { id: created.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  }, 20000);

  it("regenerates from the same stored sources, and 404s for another user", async () => {
    const { POST: createGuide } = await import("@/app/api/study-guides/route");
    const createRes = await createGuide(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({
          focus: "big picture only",
          lectures: [
            {
              lecture_id: lectureWithTopicsAndSlides,
              include_topics: true,
              include_slides: true,
              include_transcript: false,
            },
          ],
        }),
      })
    );
    const created = await createRes.json();
    expect(created.focus).toBe("big picture only");

    const { POST: regenerate } = await import("@/app/api/study-guides/[id]/regenerate/route");

    // No body change -> keeps the stored focus.
    const sameRes = await regenerate(
      new NextRequest("http://localhost/api/study-guides/x/regenerate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(sameRes.status).toBe(200);
    const same = await sameRes.json();
    expect(same.focus).toBe("big picture only");
    expect(same.sources).toHaveLength(1);

    // Explicit focus overrides the stored one; title stays put.
    const changedRes = await regenerate(
      new NextRequest("http://localhost/api/study-guides/x/regenerate", {
        method: "POST",
        body: JSON.stringify({ focus: "definitions only" }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    const changed = await changedRes.json();
    expect(changed.focus).toBe("definitions only");
    expect(changed.title).toBe(created.title);

    const otherUser = await prisma.user.create({
      data: { email: `study-guide-test-regen-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = otherUser.id;
    const theirRegen = await regenerate(
      new NextRequest("http://localhost/api/study-guides/x/regenerate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(theirRegen.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.study_guides.deleteMany({ where: { id: created.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  }, 20000);

  it("generates flashcards and a quiz from a guide's content, scoped to the owner", async () => {
    const { POST: createGuide } = await import("@/app/api/study-guides/route");
    const createRes = await createGuide(
      new NextRequest("http://localhost/api/study-guides", {
        method: "POST",
        body: JSON.stringify({
          lectures: [
            {
              lecture_id: lectureWithTranscriptOnly,
              include_topics: false,
              include_slides: false,
              include_transcript: true,
            },
          ],
        }),
      })
    );
    const created = await createRes.json();
    expect(created.flashcards).toBeNull();
    expect(created.quiz).toBeNull();

    const { POST: genCards } = await import("@/app/api/study-guides/[id]/flashcards/route");
    const cardsRes = await genCards(
      new NextRequest("http://localhost/api/study-guides/x/flashcards", { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(cardsRes.status).toBe(200);
    const cardsBody = await cardsRes.json();
    expect(cardsBody.used_mock).toBe(true);
    expect(cardsBody.cards.length).toBeGreaterThan(0);
    expect(cardsBody.cards[0]).toHaveProperty("front");
    expect(cardsBody.cards[0]).toHaveProperty("back");

    const { POST: genQuiz } = await import("@/app/api/study-guides/[id]/quiz/route");
    const quizRes = await genQuiz(
      new NextRequest("http://localhost/api/study-guides/x/quiz", { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(quizRes.status).toBe(200);
    const quizBody = await quizRes.json();
    expect(quizBody.used_mock).toBe(true);
    expect(quizBody.questions[0].options).toHaveLength(4);

    const { GET: getGuide } = await import("@/app/api/study-guides/[id]/route");
    const fetchedRes = await getGuide(new NextRequest("http://localhost/api/study-guides/x"), {
      params: Promise.resolve({ id: created.id }),
    });
    const fetched = await fetchedRes.json();
    expect(fetched.flashcards.length).toBeGreaterThan(0);
    expect(fetched.quiz.length).toBeGreaterThan(0);

    const otherUser = await prisma.user.create({
      data: { email: `study-guide-test-cards-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = otherUser.id;
    const theirCards = await genCards(
      new NextRequest("http://localhost/api/study-guides/x/flashcards", { method: "POST" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(theirCards.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.study_guides.deleteMany({ where: { id: created.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  }, 20000);
});
