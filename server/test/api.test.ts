import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `api-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("REST API (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("400s when no user email is supplied", async () => {
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(400);
  });

  it("supports full CRUD for courses and items", async () => {
    const authed = () => ({
      get: (url: string) => request(app).get(url).set("X-User-Email", testEmail),
      post: (url: string) => request(app).post(url).set("X-User-Email", testEmail),
      patch: (url: string) => request(app).patch(url).set("X-User-Email", testEmail),
      delete: (url: string) => request(app).delete(url).set("X-User-Email", testEmail),
    });

    const created = await authed().post("/api/courses").send({
      course_code: "CS135",
      course_name: "Designing Functional Programs",
      semester: "1A",
    });
    expect(created.status).toBe(201);
    const courseId = created.body.id;

    const list = await authed().get("/api/courses");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].course_code).toBe("CS135");

    const itemCreated = await authed().post(`/api/courses/${courseId}/items`).send({
      name: "Assignment 1",
      type: "assignment",
      due_date: "2026-09-20",
      due_time: null,
      weight: "10%",
      notes: null,
    });
    expect(itemCreated.status).toBe(201);
    expect(itemCreated.body.is_datetime).toBe(false);
    const itemId = itemCreated.body.id;

    const timedItem = await authed().post(`/api/courses/${courseId}/items`).send({
      name: "Assignment 2",
      type: "assignment",
      due_date: "2026-09-27",
      due_time: "23:59",
      weight: null,
      notes: null,
    });
    expect(timedItem.status).toBe(201);
    expect(timedItem.body.is_datetime).toBe(true);

    const itemsForCourse = await authed().get(`/api/courses/${courseId}/items`);
    expect(itemsForCourse.body).toHaveLength(2);

    const allItems = await authed().get("/api/items");
    expect(allItems.body).toHaveLength(2);

    const updated = await authed().patch(`/api/items/${itemId}`).send({
      status: "done",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("done");

    const updatedDate = await authed().patch(`/api/items/${itemId}`).send({
      due_date: "2026-09-21",
      due_time: "09:00",
    });
    expect(updatedDate.status).toBe(200);
    expect(updatedDate.body.is_datetime).toBe(true);

    const badUpdate = await authed().patch(`/api/items/${itemId}`).send({
      due_date: "2026-09-21",
    });
    expect(badUpdate.status).toBe(400);

    const deletedItem = await authed().delete(`/api/items/${itemId}`);
    expect(deletedItem.status).toBe(204);

    const notFound = await authed().delete(`/api/items/${itemId}`);
    expect(notFound.status).toBe(404);

    const deletedCourse = await authed().delete(`/api/courses/${courseId}`);
    expect(deletedCourse.status).toBe(204);

    const coursesAfterDelete = await authed().get("/api/courses");
    expect(coursesAfterDelete.body).toHaveLength(0);
  });

  it("scopes courses/items to the requesting user", async () => {
    const otherEmail = `api-test-other-${Date.now()}@example.com`;
    const mine = await request(app)
      .post("/api/courses")
      .set("X-User-Email", testEmail)
      .send({
        course_code: "ISOLATED101",
        course_name: "Isolation Test",
        semester: null,
      });

    const theirs = await request(app)
      .get(`/api/courses/${mine.body.id}`)
      .set("X-User-Email", otherEmail);
    expect(theirs.status).toBe(404);

    await pool.query("DELETE FROM users WHERE email = $1", [otherEmail]);
  });
});
