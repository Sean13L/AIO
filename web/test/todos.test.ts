import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `todo-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

describe.skipIf(!hasDb)("Todos API routes (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("supports full CRUD, scoped to the requesting user", async () => {
    const { GET, POST } = await import("@/app/api/todos/route");
    const { PATCH, DELETE } = await import("@/app/api/todos/[id]/route");

    const createRes = await POST(
      new NextRequest("http://localhost/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: "Return library book" }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.done).toBe(false);

    const listRes = await GET();
    expect(await listRes.json()).toHaveLength(1);

    const rejectedRes = await POST(
      new NextRequest("http://localhost/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      })
    );
    expect(rejectedRes.status).toBe(400);

    const patchRes = await PATCH(
      new NextRequest("http://localhost/api/todos/x", {
        method: "PATCH",
        body: JSON.stringify({ done: true }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).done).toBe(true);

    // Another user can't see or modify it.
    const other = await prisma.user.create({
      data: { email: `todo-test-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = other.id;

    const theirPatchRes = await PATCH(
      new NextRequest("http://localhost/api/todos/x", {
        method: "PATCH",
        body: JSON.stringify({ done: false }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(theirPatchRes.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.user.delete({ where: { id: other.id } });

    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/todos/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await GET();
    expect(await afterDeleteRes.json()).toEqual([]);
  });

  it("supports an optional deadline: set on create, edit, clear, and sorts dated-before-undated", async () => {
    const { GET, POST } = await import("@/app/api/todos/route");
    const { PATCH } = await import("@/app/api/todos/[id]/route");

    const undated = await POST(
      new NextRequest("http://localhost/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: "Someday task" }),
      })
    );
    const undatedBody = await undated.json();
    expect(undatedBody.due_at).toBeNull();
    expect(undatedBody.is_datetime).toBe(false);

    const dated = await POST(
      new NextRequest("http://localhost/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: "Email TA", due_date: "2026-10-05", due_time: "14:00" }),
      })
    );
    const datedBody = await dated.json();
    expect(datedBody.due_at).toBe("2026-10-05T14:00:00.000Z");
    expect(datedBody.is_datetime).toBe(true);

    const allDay = await POST(
      new NextRequest("http://localhost/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: "Return book", due_date: "2026-10-01", due_time: null }),
      })
    );
    const allDayBody = await allDay.json();
    expect(allDayBody.due_at).toBe("2026-10-01T00:00:00.000Z");
    expect(allDayBody.is_datetime).toBe(false);

    // Dated todos sorted soonest-first, undated todos after.
    const list = await (await GET()).json();
    const titles = list.map((t: { title: string }) => t.title);
    expect(titles.slice(0, 2)).toEqual(["Return book", "Email TA"]);
    expect(titles.slice(2)).toContain("Someday task");

    // A plain "mark done" PATCH doesn't touch an existing deadline.
    const markDone = await PATCH(
      new NextRequest("http://localhost/api/todos/x", {
        method: "PATCH",
        body: JSON.stringify({ done: true }),
      }),
      { params: Promise.resolve({ id: datedBody.id }) }
    );
    expect((await markDone.json()).due_at).toBe("2026-10-05T14:00:00.000Z");

    // Explicitly clearing the deadline sets it back to null.
    const cleared = await PATCH(
      new NextRequest("http://localhost/api/todos/x", {
        method: "PATCH",
        body: JSON.stringify({ due_date: null }),
      }),
      { params: Promise.resolve({ id: datedBody.id }) }
    );
    const clearedBody = await cleared.json();
    expect(clearedBody.due_at).toBeNull();
    expect(clearedBody.is_datetime).toBe(false);

    await prisma.todos.deleteMany({ where: { id: { in: [undatedBody.id, datedBody.id, allDayBody.id] } } });
  });

  it("401s with no session", async () => {
    const originalUserId = mockSession.userId;
    mockSession.userId = null as unknown as string;

    const { GET } = await import("@/app/api/todos/route");
    const res = await GET();
    expect(res.status).toBe(401);

    mockSession.userId = originalUserId;
  });
});
