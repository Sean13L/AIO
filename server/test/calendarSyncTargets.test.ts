import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/api/app.js";
import { pool } from "../src/db/client.js";

const hasDb = Boolean(process.env.DATABASE_URL);
const testEmail = `sync-target-test-${Date.now()}@example.com`;
const app = createApp();

describe.skipIf(!hasDb)("Calendar sync targets (requires DATABASE_URL)", () => {
  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [testEmail]);
    await pool.end();
  });

  it("supports adding, listing, and removing ics_subscriber sync targets", async () => {
    const authed = (method: "get" | "post" | "delete") => (url: string) =>
      request(app)[method](url).set("X-User-Email", testEmail);

    const empty = await authed("get")("/api/calendar-feed/sync-targets");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const created = await authed("post")("/api/calendar-feed/sync-targets").send({
      label: "Mom's calendar",
    });
    expect(created.status).toBe(201);
    expect(created.body.target_type).toBe("ics_subscriber");
    expect(created.body.label).toBe("Mom's calendar");

    const list = await authed("get")("/api/calendar-feed/sync-targets");
    expect(list.body).toHaveLength(1);

    const rejected = await authed("post")("/api/calendar-feed/sync-targets").send({ label: "" });
    expect(rejected.status).toBe(400);

    const deleted = await authed("delete")(`/api/calendar-feed/sync-targets/${created.body.id}`);
    expect(deleted.status).toBe(204);

    const afterDelete = await authed("get")("/api/calendar-feed/sync-targets");
    expect(afterDelete.body).toEqual([]);
  });

  it("scopes sync targets to the requesting user", async () => {
    const otherEmail = `sync-target-test-other-${Date.now()}@example.com`;
    const mine = await request(app)
      .post("/api/calendar-feed/sync-targets")
      .set("X-User-Email", testEmail)
      .send({ label: "Study partner" });

    const theirDelete = await request(app)
      .delete(`/api/calendar-feed/sync-targets/${mine.body.id}`)
      .set("X-User-Email", otherEmail);
    expect(theirDelete.status).toBe(404);

    await pool.query("DELETE FROM users WHERE email = $1", [otherEmail]);
  });
});
