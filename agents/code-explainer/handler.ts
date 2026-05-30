import type { HandlerResult, StartTaskMessage, TaskContext } from "@blocks-network/sdk";
import { generateObject } from "ai";
import { z } from "zod";
import { model } from "../../lib/openrouter.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

const InputSchema = z.object({
  code: z.string(),
  context: z.string().optional(),
});

const OutputSchema = z.object({
  technical: z.object({
    what_it_does: z.string(),
    how_it_works: z.string(),
    key_concepts: z.array(z.string()),
    gotchas: z.array(z.string()),
  }),
  non_technical: z.object({
    plain_english_summary: z.string(),
    business_value: z.string(),
    risks_or_unknowns: z.array(z.string()),
    questions_for_engineering: z.array(z.string()),
  }),
});

export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  const part = task.requestParts?.[0] as { text?: string } | string | undefined;
  const raw = typeof part === "string" ? part : (part?.text ?? "{}");
  const input = InputSchema.parse(JSON.parse(raw));

  ctx?.reportStatus("Explaining code...");

  const { object } = await generateObject({
    model,
    schema: OutputSchema,
    mode: "json",
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
  });

  return {
    artifacts: [{ data: JSON.stringify(object, null, 2), mimeType: "application/json" }],
  };
}
