import type {
  HandlerResult,
  StartTaskMessage,
  TaskContext,
} from "@blocks-network/sdk";

/**
 * Main handler for the blocks_poc agent.
 * Processes incoming tasks by extracting text input and returning it in uppercase.
 *
 * @param {StartTaskMessage} task - The incoming task containing request parts with text input
 * @param {TaskContext} [ctx] - Optional context for reporting status updates to the platform
 * @returns {Promise<HandlerResult>} Result containing the uppercase text as a text/plain artifact
 * @example
 * // Input: { text: "hello" }
 * // Output: "HELLO"
 */
export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  const input = task.requestParts?.[0];
  const text =
    typeof input === "string"
      ? input
      : (((input as Record<string, unknown>)?.text as string) ?? "default");

  ctx?.reportStatus("Echoing text...");

  return {
    artifacts: [{ data: text.toUpperCase(), mimeType: "text/plain" }],
  };
}
