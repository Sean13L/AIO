import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `extracurricular-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("Extracurriculars (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("supports full CRUD, freeform and unrelated to the grading schema", async () => {
    const authed = (method: "get" | "post" | "patch" | "delete") => (url: string) =>
      request(app)[method](url).set("X-User-Email", testEmail);

    const created = await authed("post")("/api/extracurriculars").send({
      title: "Robotics club",
      content: "Meets Thursdays, building a line-follower for regionals.",
    });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const list = await authed("get")("/api/extracurriculars");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe("Robotics club");

    const updated = await authed("patch")(`/api/extracurriculars/${id}`).send({
      content: "Meets Thursdays — regionals moved up to next month.",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Robotics club"); // untouched field persists
    expect(updated.body.content).toContain("regionals moved up");

    const rejected = await authed("post")("/api/extracurriculars").send({ title: "" });
    expect(rejected.status).toBe(400);

    const deleted = await authed("delete")(`/api/extracurriculars/${id}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await authed("get")("/api/extracurriculars");
    expect(afterDelete.body).toEqual([]);
  });

  it("scopes extracurriculars to the requesting user", async () => {
    const otherEmail = `extracurricular-test-other-${Date.now()}@example.com`;
    const mine = await request(app)
      .post("/api/extracurriculars")
      .set("X-User-Email", testEmail)
      .send({ title: "Mine", content: null });

    const theirDelete = await request(app)
      .delete(`/api/extracurriculars/${mine.body.id}`)
      .set("X-User-Email", otherEmail);
    expect(theirDelete.status).toBe(404);

    await pool.query("DELETE FROM users WHERE email = $1", [otherEmail]);
  });
});
