import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from "@google/genai";
import { recordGeminiError, type GeminiFeature } from "./geminiErrors";

// Sibling models to fall back through when the configured model returns a
// capacity/quota error — observed during a real Gemini demand spike on
// 2026-09-20 that took out the whole gemini-3.x flash lineup simultaneously
// for several minutes (503/UNAVAILABLE), confirmed by watching this
// fallback chain exhaust 3.6 -> 3.7 -> 3.5 in production logs. All flash
// (or flash-lite) tier, same cost/quota class as the primary default, so
// falling back among them doesn't trade accuracy or spend for availability.
// "gemini-flash-latest"/"gemini-flash-lite-latest" are aliases Google keeps
// pointed at whichever model is current in each tier.
//
// Deliberately NO pro-tier model in this list, after two rounds of finding
// dead ends here: gemini-2.5-flash 404s as "no longer available to new
// users" on this project, and gemini-2.5-pro / gemini-pro-latest (checked
// 2026-09-22) both 429 with RESOURCE_EXHAUSTED reporting "limit: 0" for the
// free tier — not a transient rate limit, a hard wall — so a pro model can
// never succeed here on a free-tier key and would just waste a hop.
const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

export function isCapacityError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // 503/UNAVAILABLE: the model is temporarily overloaded. 429/
  // RESOURCE_EXHAUSTED: this specific model's quota is exhausted (or, per
  // the pro-tier case above, permanently zero) — a sibling model has its
  // own separate quota, so this is just as worth falling back on.
  return /"code"\s*:\s*(503|429)|\bUNAVAILABLE\b|\bRESOURCE_EXHAUSTED\b|overloaded|high demand/i.test(
    message
  );
}

// Wraps client.models.generateContent() with fallback across sibling models
// when the requested one is temporarily overloaded. Only retries on a
// capacity error — anything else (bad request, auth failure, safety block)
// fails immediately since switching models wouldn't fix it. Every failed
// attempt is recorded in gemini_errors under `feature`, so there's a lasting
// record of which features hit Gemini's limits.
export async function generateContentWithFallback(
  client: GoogleGenAI,
  params: GenerateContentParameters,
  feature: GeminiFeature
): Promise<GenerateContentResponse> {
  const modelsToTry = [params.model, ...FALLBACK_MODELS.filter((m) => m !== params.model)];
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      return await client.models.generateContent({ ...params, model });
    } catch (err) {
      lastError = err;
      await recordGeminiError(feature, model, err);
      if (!isCapacityError(err)) throw err;
      console.warn(`[gemini] ${model} is unavailable (capacity), falling back to next model`, err);
    }
  }

  throw lastError;
}
