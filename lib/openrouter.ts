import OpenAI from "openai";
import "dotenv/config";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export const MODEL = process.env.BLOCKS_MODEL ?? "openai/gpt-oss-120b";
