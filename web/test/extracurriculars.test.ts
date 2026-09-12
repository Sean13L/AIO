import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `extracurricular-test-${Date.now()}@example.com`;

const mockSession = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => mockSession.userId),
}));

describe.skipIf(!hasDb)("Extracurriculars API routes (requires DATABASE_URL)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: testEmail } });
    mockSession.userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockSession.userId } });
    await prisma.$disconnect();
  });

  it("supports full CRUD, scoped to the requesting user", async () => {
    const { GET, POST } = await import("@/app/api/extracurriculars/route");
    const { PATCH, DELETE } = await import("@/app/api/extracurriculars/[id]/route");

    const createRes = await POST(
      new NextRequest("http://localhost/api/extracurriculars", {
        method: "POST",
        body: JSON.stringify({
          title: "Robotics club",
          content: "Meets Thursdays, building a line-follower for regionals.",
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const listRes = await GET();
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Robotics club");

    const rejectedRes = await POST(
      new NextRequest("http://localhost/api/extracurriculars", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      })
    );
    expect(rejectedRes.status).toBe(400);

    const patchRes = await PATCH(
      new NextRequest("http://localhost/api/extracurriculars/x", {
        method: "PATCH",
        body: JSON.stringify({ content: "Meets Thursdays — regionals moved up." }),
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.title).toBe("Robotics club"); // untouched field persists
    expect(updated.content).toContain("moved up");

    const other = await prisma.user.create({
      data: { email: `extracurricular-test-other-${Date.now()}@example.com` },
    });
    const originalUserId = mockSession.userId;
    mockSession.userId = other.id;

    const theirDeleteRes = await DELETE(
      new NextRequest("http://localhost/api/extracurriculars/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(theirDeleteRes.status).toBe(404);

    mockSession.userId = originalUserId;
    await prisma.user.delete({ where: { id: other.id } });

    const deleteRes = await DELETE(
      new NextRequest("http://localhost/api/extracurriculars/x", { method: "DELETE" }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await GET();
    expect(await afterDeleteRes.json()).toEqual([]);
  });
});
