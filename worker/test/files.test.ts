import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { STORAGE_ROOT } from "../src/storage.js";

const app = createApp();
const apiKey = process.env.WORKER_API_KEY;

describe.skipIf(!apiKey)("Worker file storage API (requires WORKER_API_KEY)", () => {
  const testDir = path.join(STORAGE_ROOT, "lectures");

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("rejects uploads without the shared API key", async () => {
    const res = await request(app)
      .post("/files/lectures")
      .attach("file", Buffer.from("hello"), "slides.txt");
    expect(res.status).toBe(401);
  });

  it("uploads, downloads, and extracts text from a file, honoring a requested filename", async () => {
    const uploadRes = await request(app)
      .post("/files/lectures")
      .set("Authorization", `Bearer ${apiKey}`)
      .field("filename", "lecture-1.txt")
      .attach("file", Buffer.from("Today: recursion, base cases, accumulators."), "slides.txt");
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.filename).toBe("lecture-1.txt");
    expect(uploadRes.body.url).toContain("/files/lectures/lecture-1.txt");

    const downloadRes = await request(app).get("/files/lectures/lecture-1.txt");
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.text).toContain("accumulators");

    const textRes = await request(app)
      .get("/files/lectures/lecture-1.txt/text")
      .set("Authorization", `Bearer ${apiKey}`);
    expect(textRes.status).toBe(200);
    expect(textRes.body.text).toContain("recursion");

    // Re-uploading the same requested filename replaces it (matches
    // "replace slides" semantics on the lecture page).
    const replaceRes = await request(app)
      .post("/files/lectures")
      .set("Authorization", `Bearer ${apiKey}`)
      .field("filename", "lecture-1.txt")
      .attach("file", Buffer.from("Replaced content."), "new.txt");
    expect(replaceRes.status).toBe(200);
    const afterReplace = await request(app).get("/files/lectures/lecture-1.txt");
    expect(afterReplace.text).toBe("Replaced content.");
  });

  it("404s for a missing file and rejects path traversal", async () => {
    const missing = await request(app).get("/files/lectures/does-not-exist.txt");
    expect(missing.status).toBe(404);

    const traversal = await request(app).get("/files/lectures/..%2f..%2fpackage.json");
    expect([400, 404]).toContain(traversal.status);
  });
});
