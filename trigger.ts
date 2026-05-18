import type {
  ArtifactEvent,
  ProgressEvent,
  TerminalEvent,
} from "@blocks-network/sdk";
import {
  decodeInlineArtifact,
  TaskClient,
  textPart,
} from "@blocks-network/sdk";
import "dotenv/config";

/**
 * Trigger a task on the blocks_poc agent and print the result.
 * Creates a client, sends a message, and subscribes to progress/artifact/terminal events.
 *
 * @example
 * npx tsx trigger.ts
 */
async function main() {
  const client = await TaskClient.create({
    billingMode: "free",
    apiKey: process.env.BLOCKS_API_KEY!,
  });

  const session = await client.sendMessage({
    agentName: "blocks_poc",
    requestParts: [
      textPart(JSON.stringify({ text: "Hello from trigger!" }), "request"),
    ],
  });

  console.log("Task created:", session.taskId);

  /**
   * Handle progress updates from the running task.
   * @param {ProgressEvent} event - Progress event containing message or progress percentage
   */
  session.onProgress((event: ProgressEvent) => {
    console.log("[progress]", event.message ?? event.progress ?? "");
  });

  /**
   * Handle artifacts emitted by the task.
   * Decodes inline artifacts directly, downloads remote artifacts.
   * @param {ArtifactEvent} event - Artifact event containing reference to output data
   */
  session.onArtifact(async (event: ArtifactEvent) => {
    const ref = event.artifactRef;
    if (ref.kind === "inline" && ref.data) {
      const bytes = decodeInlineArtifact(ref);
      console.log("[artifact]", new TextDecoder().decode(bytes));
    } else {
      const downloaded = await session.downloadArtifact(ref);
      console.log("[artifact]", new TextDecoder().decode(downloaded.data));
    }
  });

  /**
   * Handle task completion (terminal event).
   * Cleans up session and client resources.
   * @param {TerminalEvent} _event - Terminal event (unused)
   */
  session.onTerminal((_event: TerminalEvent) => {
    console.log("[done] Task complete");
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
