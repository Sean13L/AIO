import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `course-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

describe.skipIf(!hasDb)("Courses/Items API routes (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("supports full CRUD for courses and items, scoped to the requesting user", async () => {
    const { GET: listCourses, POST: createCourse } = await import("@/app/api/courses/route");
    const { GET: getCourse, DELETE: deleteCourse } = await import("@/app/api/courses/[id]/route");
    const { GET: listItems, POST: createItem } = await import(
      "@/app/api/courses/[id]/items/route"
    );
    const { GET: listAllItems } = await import("@/app/api/items/route");
    const { PATCH: patchItem, DELETE: deleteItem } = await import("@/app/api/items/[id]/route");

    const courseRes = await createCourse(
      new NextRequest("http://localhost/api/courses", {
        method: "POST",
        body: JSON.stringify({
          course_code: "CS135",
          course_name: "Designing Functional Programs",
          semester: "1A",
        }),
      })
    );
    expect(courseRes.status).toBe(201);
    const course = await courseRes.json();

    const listRes = await listCourses();
    expect(await listRes.json()).toHaveLength(1);

    const getRes = await getCourse(new NextRequest("http://localhost/api/courses/x"), {
      params: Promise.resolve({ id: course.id }),
    });
    expect(getRes.status).toBe(200);

    const item1Res = await createItem(
      new NextRequest("http://localhost/api/courses/x/items", {
        method: "POST",
        body: JSON.stringify({
          name: "Assignment 1",
          type: "assignment",
          due_date: "2026-09-20",
          due_time: null,
          weight: "10%",
          notes: null,
        }),
      }),
      { params: Promise.resolve({ id: course.id }) }
    );
    expect(item1Res.status).toBe(201);
    const item1 = await item1Res.json();
    expect(item1.is_datetime).toBe(false);

    const item2Res = await createItem(
      new NextRequest("http://localhost/api/courses/x/items", {
        method: "POST",
        body: JSON.stringify({
          name: "Assignment 2",
          type: "assignment",
          due_date: "2026-09-27",
          due_time: "23:59",
          weight: null,
          notes: null,
        }),
      }),
      { params: Promise.resolve({ id: course.id }) }
    );
    expect((await item2Res.json()).is_datetime).toBe(true);

    const itemsForCourseRes = await listItems(new NextRequest("http://localhost/api/x/items"), {
      params: Promise.resolve({ id: course.id }),
    });
    expect(await itemsForCourseRes.json()).toHaveLength(2);

    const allItemsRes = await listAllItems();
    const allItems = await allItemsRes.json();
    expect(allItems).toHaveLength(2);
    expect(allItems[0].course_code).toBe("CS135");

    const updateRes = await patchItem(
      new NextRequest("http://localhost/api/items/x", {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      }),
      { params: Promise.resolve({ id: item1.id }) }
    );
    expect(updateRes.status).toBe(200);
    expect((await updateRes.json()).status).toBe("done");

    const badUpdateRes = await patchItem(
      new NextRequest("http://localhost/api/items/x", {
        method: "PATCH",
        body: JSON.stringify({ due_date: "2026-09-21" }), // missing due_time
      }),
      { params: Promise.resolve({ id: item1.id }) }
    );
    expect(badUpdateRes.status).toBe(400);

    const deleteItemRes = await deleteItem(
      new NextRequest("http://localhost/api/items/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: item1.id }) }
    );
    expect(deleteItemRes.status).toBe(204);

    const deleteCourseRes = await deleteCourse(
      new NextRequest("http://localhost/api/courses/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: course.id }) }
    );
    expect(deleteCourseRes.status).toBe(204);

    const afterRes = await listCourses();
    expect(await afterRes.json()).toEqual([]);
  });

  it("scopes courses to the requesting user", async () => {
    const { POST: createCourse } = await import("@/app/api/courses/route");
    const { GET: getCourse } = await import("@/app/api/courses/[id]/route");

    const mine = await createCourse(
      new NextRequest("http://localhost/api/courses", {
        method: "POST",
        body: JSON.stringify({ course_code: "ISOLATED", course_name: "Isolation", semester: null }),
      })
    );
    const course = await mine.json();

    const other = await prisma.user.create({
      data: { email: `course-test-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = other.id;

    const theirGetRes = await getCourse(new NextRequest("http://localhost/api/courses/x"), {
      params: Promise.resolve({ id: course.id }),
    });
    expect(theirGetRes.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.user.delete({ where: { id: other.id } });
    await prisma.courses.delete({ where: { id: course.id } });
  });
});
