import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import "dotenv/config";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

if (!process.env.BLOCKS_MODEL) {
  throw new Error("BLOCKS_MODEL env var is required");
}

if (!process.env.BLOCKS_PROVIDER_ORDER) {
  throw new Error("BLOCKS_PROVIDER_ORDER env var is required");
}

export const MODEL_ID = process.env.BLOCKS_MODEL;

/**
 * Provider routing: Vertex AI (priority) → Cerebras (fp16 fallback).
 * Override via BLOCKS_PROVIDER_ORDER (comma-separated slugs, e.g. "Vertex AI,Cerebras").
 */
const order = process.env.BLOCKS_PROVIDER_ORDER;
const providerOrder: string[] = order.split(",").map((s) => s.trim());

/** AI SDK LanguageModelV1 — pass to generateObject / generateText */
export const model = openrouter(MODEL_ID, {
  provider: {
    order: providerOrder,
    allow_fallbacks: true,
  },
});
