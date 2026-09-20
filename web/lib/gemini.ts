import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from "@google/genai";

// Sibling models to fall back through when the configured model returns a
// capacity error (503/UNAVAILABLE — observed during a real Gemini demand
// spike on 2026-09-20 that took out the whole gemini-3.x flash lineup
// simultaneously for several minutes, confirmed by watching this fallback
// chain exhaust 3.6 -> 3.7 -> 3.5 in production logs). Flash siblings first
// (same cost/quota class as the primary default, so falling back among them
// doesn't trade accuracy or spend for availability), then "gemini-flash-latest"
// (an alias Google keeps pointed at whichever flash model is current), then
// gemini-2.5-pro as a last resort — a different tier/capacity pool, so it can
// still have headroom during a flash-wide outage, at higher cost/latency.
// gemini-2.5-flash deliberately isn't in this list: it 404s as "no longer
// available to new users" on this project rather than erroring with
// capacity, so it can never succeed here and would just waste a hop.
const FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
];

function isCapacityError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /"code"\s*:\s*503|\bUNAVAILABLE\b|overloaded|high demand/i.test(message);
}

// Wraps client.models.generateContent() with fallback across sibling models
// when the requested one is temporarily overloaded. Only retries on a
// capacity error — anything else (bad request, auth failure, safety block)
// fails immediately since switching models wouldn't fix it.
export async function generateContentWithFallback(
  client: GoogleGenAI,
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  const modelsToTry = [params.model, ...FALLBACK_MODELS.filter((m) => m !== params.model)];
  let lastError: unknown;

  for (const model of modelsToTry) {
    try {
      return await client.models.generateContent({ ...params, model });
    } catch (err) {
      lastError = err;
      if (!isCapacityError(err)) throw err;
      console.warn(`[gemini] ${model} is unavailable (capacity), falling back to next model`, err);
    }
  }

  throw lastError;
}
