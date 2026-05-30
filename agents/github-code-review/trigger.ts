import type { ArtifactEvent, ProgressEvent, TerminalEvent } from "@blocks-network/sdk";
import { TaskClient, decodeInlineArtifact, textPart } from "@blocks-network/sdk";
import "dotenv/config";

const input = {
  pull_request_url: "https://github.com/sourcefuse/biz-book-api/pull/2520",
  context: "Review this PR for security, correctness, and performance issues.",
  submit: false,
};

async function main() {
  const client = await TaskClient.create({
    billingMode: "free",
    apiKey: process.env.BLOCKS_API_KEY!,
  });

  const session = await client.sendMessage({
    agentName: "github_code_reviewer",
    requestParts: [textPart(JSON.stringify(input), "request")],
  });

  console.log("Task created:", session.taskId);

  session.onProgress((event: ProgressEvent) => {
    console.log("[progress]", event.message ?? event.progress ?? "");
  });

  session.onArtifact(async (event: ArtifactEvent) => {
    const ref = event.artifactRef;
    const bytes =
      ref.kind === "inline" && ref.data
        ? decodeInlineArtifact(ref)
        : await session.downloadArtifact(ref).then((a) => a.data);

    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    console.log("\n=== SUMMARY ===");
    console.log(parsed.summary);
    console.log("\n=== RISK LEVEL ===", parsed.risk_level.toUpperCase());
    console.log("\n=== COMMENTS ===", parsed.comments.length, "total");

    for (const c of parsed.comments) {
      console.log(`  [${c.severity.toUpperCase()}] ${c.path}:${c.line} (${c.side}) — ${c.category}`);
    }

    console.log("\n=== MARKDOWN REVIEW ===");
    console.log(parsed.review_comment_markdown);

    console.log("\n=== SUBMITTED ===", parsed.submitted);
    if (parsed.review_url) console.log("Review URL:", parsed.review_url);
  });

  session.onTerminal((_event: TerminalEvent) => {
    console.log("\n[done] Task complete");
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
