import { describe, expect, it, vi } from "vitest";
import { generateContentWithFallback } from "@/lib/gemini";
import type { GoogleGenAI } from "@google/genai";

function fakeClient(generateContent: (params: { model: string }) => Promise<unknown>) {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

const overloadedError = () =>
  new Error('{"error":{"code":503,"message":"...high demand...","status":"UNAVAILABLE"}}');

const quotaExhaustedError = () =>
  new Error(
    '{"error":{"code":429,"message":"Quota exceeded... limit: 0...","status":"RESOURCE_EXHAUSTED"}}'
  );

describe("generateContentWithFallback", () => {
  it("returns the primary model's response when it succeeds", async () => {
    const generateContent = vi.fn(async ({ model }: { model: string }) => ({ text: `ok:${model}` }));
    const client = fakeClient(generateContent);

    const result = await generateContentWithFallback(client, {
      model: "gemini-3.6-flash",
      contents: "hi",
    });

    expect(result).toEqual({ text: "ok:gemini-3.6-flash" });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next model when the primary is overloaded", async () => {
    const generateContent = vi.fn(async ({ model }: { model: string }) => {
      if (model === "gemini-3.6-flash") throw overloadedError();
      return { text: `ok:${model}` };
    });
    const client = fakeClient(generateContent);

    const result = await generateContentWithFallback(client, {
      model: "gemini-3.6-flash",
      contents: "hi",
    });

    expect(result).toEqual({ text: "ok:gemini-3.7-flash" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("tries every fallback in order before giving up", async () => {
    const attempted: string[] = [];
    const generateContent = vi.fn(async ({ model }: { model: string }) => {
      attempted.push(model);
      throw overloadedError();
    });
    const client = fakeClient(generateContent);

    await expect(
      generateContentWithFallback(client, { model: "gemini-3.6-flash", contents: "hi" })
    ).rejects.toThrow();

    expect(attempted).toEqual([
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
    ]);
  });

  it("falls back on a 429 RESOURCE_EXHAUSTED (per-model quota exhausted), same as a 503", async () => {
    const generateContent = vi.fn(async ({ model }: { model: string }) => {
      if (model === "gemini-3.6-flash") throw quotaExhaustedError();
      return { text: `ok:${model}` };
    });
    const client = fakeClient(generateContent);

    const result = await generateContentWithFallback(client, {
      model: "gemini-3.6-flash",
      contents: "hi",
    });

    expect(result).toEqual({ text: "ok:gemini-3.7-flash" });
  });

  it("does not fall back on a non-capacity error (fails fast)", async () => {
    const generateContent = vi.fn(async () => {
      throw new Error('{"error":{"code":400,"message":"invalid api key","status":"INVALID_ARGUMENT"}}');
    });
    const client = fakeClient(generateContent);

    await expect(
      generateContentWithFallback(client, { model: "gemini-3.6-flash", contents: "hi" })
    ).rejects.toThrow(/invalid api key/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry a model already tried as the primary", async () => {
    const attempted: string[] = [];
    const generateContent = vi.fn(async ({ model }: { model: string }) => {
      attempted.push(model);
      if (model === "gemini-3.5-flash") return { text: "ok" };
      throw overloadedError();
    });
    const client = fakeClient(generateContent);

    const result = await generateContentWithFallback(client, {
      model: "gemini-3.5-flash",
      contents: "hi",
    });

    expect(result).toEqual({ text: "ok" });
    expect(attempted).toEqual(["gemini-3.5-flash"]);
  });
});
