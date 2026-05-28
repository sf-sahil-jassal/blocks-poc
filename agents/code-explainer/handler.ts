import type { HandlerResult, StartTaskMessage, TaskContext } from "@blocks-network/sdk";
import { extractJSON } from "../../lib/json-extract.js";
import { MODEL, openrouter } from "../../lib/openrouter.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

type ExplainerInput = {
  code: string;
  context?: string;
};

type ExplainerOutput = {
  technical: {
    what_it_does: string;
    how_it_works: string;
    key_concepts: string[];
    gotchas: string[];
  };
  non_technical: {
    plain_english_summary: string;
    business_value: string;
    risks_or_unknowns: string[];
    questions_for_engineering: string[];
  };
};

export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  const part = task.requestParts?.[0] as { text?: string } | string | undefined;
  const raw = typeof part === "string" ? part : (part?.text ?? "{}");
  const input = extractJSON<ExplainerInput>(raw);

  ctx?.reportStatus("Explaining code...");

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const result = extractJSON<ExplainerOutput>(
    response.choices[0].message.content ?? "",
  );

  return {
    artifacts: [{ data: JSON.stringify(result, null, 2), mimeType: "application/json" }],
  };
}
