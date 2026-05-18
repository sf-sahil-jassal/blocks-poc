## Overview

Blocks Network A2A agent POC. Single-package, no monorepo. TypeScript runs directly via `tsx` — no compilation step.

## Blocks-Specific Gotchas

### TypeScript Execution

Run tests with `npx tsx trigger.ts`, not `npx tsc trigger.ts`. Passing files directly to tsc bypasses config, so it won't resolve @blocks-network/sdk. tsx executes TypeScript directly, no compilation needed.

### Blocks CLI Commands

```bash
blocks login --write-env    # Creates .env with BLOCKS_API_KEY
blocks publish              # Register agent to registry
blocks check                # Validate agent-card.json
blocks run                  # Start agent (uses agent-card.json)
blocks dashboard             # Web UI for testing agents
```

### Architecture Difference

Not HTTP-based. Use `ctx!.taskClient.sendMessage()` to call other agents instead of HTTP requests.

Transport uses PubNub (WebSockets with HTTP streaming fallback) and real-time bidirectional channels for streaming. Connections are long-lived TCP, not request/response.

Agent registry makes agents discoverable by name, not hardcoded URLs. Registry lookup resolves agent name to PubNub channel, so there's no need to manage URLs or endpoints.

Task events are built-in — progress, artifacts, terminal — pushed via PubNub WebSockets. Stream channels handle bidirectional data, so there's no need to build custom event infrastructure.
