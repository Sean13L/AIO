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

  it("401s with no session", async () => {
    const originalUserId = mockSession.userId;
    mockSession.userId = null as unknown as string;

    const { GET } = await import("@/app/api/todos/route");
    const res = await GET();
    expect(res.status).toBe(401);

    mockSession.userId = originalUserId;
  });
});
