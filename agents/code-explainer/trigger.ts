import type { ArtifactEvent, ProgressEvent, TerminalEvent } from "@blocks-network/sdk";
import { TaskClient, decodeInlineArtifact, textPart } from "@blocks-network/sdk";
import "dotenv/config";

const input = {
  code: `
async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
`.trim(),
  context: "Express.js middleware — runs before every protected API route",
};

async function main() {
  const client = await TaskClient.create({
    billingMode: "free",
    apiKey: process.env.BLOCKS_API_KEY!,
  });

  const session = await client.sendMessage({
    agentName: "code_explainer",
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
    console.log("\n=== TECHNICAL ===");
    console.log(JSON.stringify(parsed.technical, null, 2));
    console.log("\n=== NON-TECHNICAL (for PMs) ===");
    console.log(JSON.stringify(parsed.non_technical, null, 2));
  });

  session.onTerminal((_event: TerminalEvent) => {
    console.log("\n[done] Task complete");
    session.close();
    client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
