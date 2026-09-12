import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `todo-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("Todos (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("supports full CRUD, independent of the structured items table", async () => {
    const authed = (method: "get" | "post" | "patch" | "delete") => (url: string) =>
      request(app)[method](url).set("X-User-Email", testEmail);

    const created = await authed("post")("/api/todos").send({ title: "Return library book" });
    expect(created.status).toBe(201);
    expect(created.body.done).toBe(false);
    const todoId = created.body.id;

    const list = await authed("get")("/api/todos");
    expect(list.body).toHaveLength(1);

    const toggled = await authed("patch")(`/api/todos/${todoId}`).send({ done: true });
    expect(toggled.status).toBe(200);
    expect(toggled.body.done).toBe(true);

    const renamed = await authed("patch")(`/api/todos/${todoId}`).send({
      title: "Return library book (renewed)",
    });
    expect(renamed.body.title).toBe("Return library book (renewed)");
    expect(renamed.body.done).toBe(true); // untouched fields persist

    const rejected = await authed("post")("/api/todos").send({ title: "" });
    expect(rejected.status).toBe(400);

    const deleted = await authed("delete")(`/api/todos/${todoId}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await authed("get")("/api/todos");
    expect(afterDelete.body).toEqual([]);
  });

  it("scopes todos to the requesting user", async () => {
    const otherEmail = `todo-test-other-${Date.now()}@example.com`;
    const mine = await request(app)
      .post("/api/todos")
      .set("X-User-Email", testEmail)
      .send({ title: "Mine" });

    const theirPatch = await request(app)
      .patch(`/api/todos/${mine.body.id}`)
      .set("X-User-Email", otherEmail)
      .send({ done: true });
    expect(theirPatch.status).toBe(404);

    await pool.query("DELETE FROM users WHERE email = $1", [otherEmail]);
  });
});
