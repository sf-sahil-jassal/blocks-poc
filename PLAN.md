# Blocks Network — Multi-Agent Build Plan

## Overview

Build 4 new AI-powered agents on Blocks Network, plus an A2A orchestrator that composes them. All agents run on our infrastructure, use DeepSeek V4 Flash via OpenRouter, and are published to the Blocks Network registry.

---

## Agent Inventory

| #   | Agent Name                 | Purpose                                                                                                 | Model                               |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 0   | `blocks_poc` (echo)        | Original POC — kept as reference                                                                        | none                                |
| 1   | `code_explainer`           | Explains code in two modes: technical (new devs) and non-technical (PMs/PDMs)                           | `deepseek/deepseek-v4-flash:free`   |
| 2   | `meeting_processor`        | Converts meeting notes into structured summary, decisions, and action items                             | `deepseek/deepseek-v4-flash:free`   |
| 3   | `github_code_reviewer`     | Fetches a GitHub PR diff and returns a line-aware code review with valid hunk references                | `deepseek/deepseek-v4-flash` (paid) |
| 4   | `pr_briefing_orchestrator` | A2A orchestrator — calls agents 3 + 1 in parallel and returns combined engineering review + PM briefing | `deepseek/deepseek-v4-flash:free`   |

---

## Final Repository Structure

```
blocks_poc/
  .env                              # BLOCKS_API_KEY, OPENROUTER_API_KEY, GITHUB_TOKEN
  package.json                      # Shared deps for all agents
  README.md                         # Updated overview
  ARCHITECTURE.md                   # Existing privacy/security doc
  PLAN.md                           # This file

  lib/
    openrouter.ts                   # Shared OpenAI client pointing to OpenRouter base URL
    github.ts                       # Shared Octokit client + raw diff fetcher
    json-extract.ts                 # Safe JSON parsing from LLM output (handles markdown fences)

  agents/
    echo/                           # Original POC (preserved, not modified)
      agent-card.json
      handler.ts
      trigger.ts

    code-explainer/
      agent-card.json               # agentName: code_explainer
      handler.ts
      prompts.ts                    # SYSTEM_PROMPT + buildUserPrompt(input)
      trigger.ts
      samples/
        react-component.ts
        sql-query.sql
        bash-script.sh
        regex-pattern.ts

    meeting-notes/
      agent-card.json               # agentName: meeting_processor
      handler.ts
      prompts.ts
      trigger.ts
      samples/
        engineering-standup.txt
        product-review.txt

    github-code-review/
      agent-card.json               # agentName: github_code_reviewer
      handler.ts                    # Orchestrates: fetch → parse → annotate → llm → validate → format → optional submit
      prompts.ts                    # REVIEW_SYSTEM_PROMPT + buildAnnotatedDiffPrompt(annotatedDiff)
      diff-parser.ts                # parse-diff wrapper + annotated diff builder + valid-line-range extractor
      validator.ts                  # Drops LLM comments outside valid hunk ranges
      markdown-formatter.ts         # Formats validated comments into GitHub-ready markdown
      trigger.ts
      samples/
        sample-pr-url.txt           # A real test PR URL

    pr-briefing-orchestrator/
      agent-card.json               # agentName: pr_briefing_orchestrator
      handler.ts                    # Fetches diff once, calls agent 3 + agent 1 via ctx.taskClient
      prompts.ts                    # SYNTHESIS_PROMPT for final combined output
      trigger.ts
```

---

## Where System Prompts Live

Prompts are **TypeScript files** (`prompts.ts`) inside each agent's directory — not in `agent-card.json`, not in a global config, not on Blocks Network.

Each `prompts.ts` exports two things:

```ts
// The LLM's persona and rules — sent as system message
export const SYSTEM_PROMPT = `...`;

// A function that builds the user message from handler input
export const buildUserPrompt = (input: YourInputType): string => `...`;
```

Blocks Network never sees these prompts. They run on our infrastructure.

---

## Shared Library (`lib/`)

### `lib/openrouter.ts`

```ts
import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY!,
});
```

Used by all agents. One client, all models.

### `lib/github.ts`

```ts
import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function fetchPRDiff(
  owner: string,
  repo: string,
  pull_number: number,
): Promise<string> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: { format: "diff" },
  });
  return response.data as unknown as string;
}

export function parsePRUrl(url: string): {
  owner: string;
  repo: string;
  pull_number: number;
} {
  // https://github.com/{owner}/{repo}/pull/{number}
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) throw new Error(`Invalid PR URL: ${url}`);
  return { owner: match[1], repo: match[2], pull_number: parseInt(match[3]) };
}
```

### `lib/json-extract.ts`

````ts
// LLMs sometimes wrap JSON in markdown fences. This handles both cases.
export function extractJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
````

---

## Shared `package.json` Dependencies

```json
{
  "dependencies": {
    "@blocks-network/sdk": "latest",
    "@octokit/rest": "^21",
    "dotenv": "^16",
    "openai": "^4",
    "parse-diff": "^0.11",
    "zod": "^3"
  },
  "devDependencies": {
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

---

## Phase-by-Phase Plan

---

### Phase 0 — Foundation (1-2h)

**Goal:** Restructure repo, install deps, set up shared utilities.

**Steps:**

1. Create `agents/` directory and 5 subdirectories
2. Move current `handler.ts`, `trigger.ts`, `agent-card.json` → `agents/echo/`
3. Create `lib/` with `openrouter.ts`, `github.ts`, `json-extract.ts`
4. Run `npm install openai @octokit/rest parse-diff zod tsx`
5. Add to `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-...
   GITHUB_TOKEN=ghp_...
   ```
6. Update root `README.md` with new structure

**Deliverables:**

- Clean folder skeleton
- Shared utilities stubbed out
- All deps installed
- `.env` updated

---

### Phase 1 — Code Explainer (2-3h)

**Goal:** Build the simplest LLM agent. Teaches the full Blocks loop end-to-end.

**Input schema:**

```json
{
  "code": "string — the code to explain",
  "context": "string (optional) — what the code is part of"
}
```

**Output schema:**

```json
{
  "technical": {
    "what_it_does": "string",
    "how_it_works": "string",
    "key_concepts": ["string"],
    "gotchas": ["string"]
  },
  "non_technical": {
    "plain_english_summary": "string",
    "business_value": "string",
    "risks_or_unknowns": ["string"],
    "questions_for_engineering": ["string"]
  }
}
```

**System prompt focus:**

- Technical section: written for a developer joining the team
- Non-technical section: written for a PM or stakeholder with no coding background
- Avoid jargon in non-technical section
- Be specific, not generic

**Steps:**

1. Write `agents/code-explainer/prompts.ts`
2. Write `handler.ts` with OpenRouter call + extractJSON
3. Write `agent-card.json` with dual-output schema
4. Write `trigger.ts` with a React component as test input
5. `blocks check` → `blocks publish` → `blocks run`
6. `npx tsx trigger.ts` → verify both outputs
7. Test from Blocks dashboard
8. Test 3 more samples (SQL, bash, regex)

**Deliverables:** Live `code_explainer` agent on Blocks Network.

---

### Phase 2 — Meeting Notes Processor (1-2h)

**Goal:** Extract structure from unstructured notes. Same pattern as Phase 1.

**Input schema:**

```json
{
  "notes": "string — raw meeting notes or transcript",
  "meeting_title": "string (optional)"
}
```

**Output schema:**

```json
{
  "summary": "string — 2-3 sentence overview",
  "decisions": ["string"],
  "action_items": [
    {
      "task": "string",
      "owner": "string or 'unknown'",
      "deadline": "string or 'not specified'"
    }
  ],
  "next_steps": ["string"],
  "follow_up_questions": ["string — things that were raised but not resolved"]
}
```

**Prompt notes:**

- LLMs frequently miss owners/deadlines — prompt must explicitly instruct to use "unknown" and "not specified" rather than omitting
- The `follow_up_questions` field adds value: captures open threads that usually get lost in notes

**Steps:**

1. Write `agents/meeting-notes/prompts.ts`
2. Write `handler.ts`
3. Write `agent-card.json`
4. Write `trigger.ts` with sample meeting transcript
5. Publish + test

**Deliverables:** Live `meeting_processor` agent.

---

### Phase 3 — GitHub Code Reviewer (5-7h)

**Goal:** Line-aware code review that produces validated, structured comments referencing actual diff lines. Adapted from the battle-tested `review-pr.md` workflow.

**Input schema:**

```json
{
  "pull_request_url": "https://github.com/org/repo/pull/123",
  "context": "string (optional — e.g. what this PR is supposed to do)",
  "submit": "boolean (optional, default false — if true, submits review as PENDING to GitHub)"
}
```

**Output schema:**

```json
{
  "pr_url": "string",
  "summary": "string",
  "risk_level": "low | medium | high",
  "comments": [
    {
      "path": "src/auth.ts",
      "line": 42,
      "side": "RIGHT",
      "severity": "low | medium | high",
      "category": "security | performance | correctness | design | style",
      "body": "markdown — emoji + title + issue + fix + credit"
    }
  ],
  "general_feedback": "string",
  "review_comment_markdown": "string — copy-paste ready for GitHub",
  "github_payload": {
    "commit_id": "string",
    "comments": ["array ready to POST to GitHub API"]
  },
  "submitted": "boolean",
  "review_url": "string | null — GitHub review URL if submitted"
}
```

#### Phase 3a — Diff Pipeline

**`diff-parser.ts`:**

1. Receive raw unified diff string
2. Parse with `parse-diff` package → structured hunks
3. Extract valid line ranges per file:
   - Hunk header `@@ -oldStart,oldCount +newStart,newCount @@`
   - `newStart` to `newStart + newCount - 1` = valid RIGHT lines
   - `oldStart` to `oldStart + oldCount - 1` = valid LEFT lines
4. Build annotated diff string — each line prefixed with `[FILE:src/auth.ts L42 RIGHT]`
5. Annotated diff is what gets sent to the LLM

**Diff validation rules (from `review-pr.md`):**

- `RIGHT` = additions (`+`) and context lines — 99% of comments
- `LEFT` = deletions (`-`) — rare, only when reviewing what was removed
- Lines must be within the `@@` hunk range — never outside

#### Phase 3b — LLM Review

**System prompt adapted from `review-pr.md`:**

Review focus:

- 🔴 Critical: security (injection, auth bypass, exposed secrets, no `@authorize`), data corruption, transaction leaks
- 🟠 Major: N+1 queries, missing pagination, sequential awaits (use `Promise.all`), no error handling
- 🟡 Improve: code quality, SRP violations, naming, duplication

Skip:

- ESLint/TSLint issues
- TypeScript type errors
- Formatting/style
- Missing JSDoc
- Try-catch without cleanup need

Comment body format:

````
[EMOJI] **[CATEGORY]: [TITLE]**

**Issue:** [1-2 sentences]

**Fix:**
```typescript
// suggested code
````

**Credit:** Open Code

````

#### Phase 3c — Validation

For every comment returned by LLM:
1. Verify `path` exists in diff
2. Look up valid line ranges for that `path`
3. Verify `line` falls within a hunk range
4. Verify `side` is consistent (`RIGHT` for additions, `LEFT` for deletions)
5. Drop invalid comments (log via `ctx.reportStatus`)

Goal: zero hallucinated line numbers in output.

#### Phase 3d — Markdown Formatter

Group validated comments by file, sorted by line number:

```markdown
## Review for PR #123: Add auth middleware

**Risk:** high | **Files changed:** 3 | **Comments:** 5

### src/auth.ts
- **L42 RIGHT — 🔴 Security: Token never expires**
  Set `expiresIn: '24h'` in JWT sign call.

- **L78 RIGHT — 🟠 Performance: Sequential awaits**
  Wrap in `Promise.all([...])` to parallelize.

### tests/auth.test.ts
- **L15 RIGHT — 🟡 Quality: Use `it()` not `test()`**
  Consistent with rest of test suite.

---
*General feedback: Overall solid approach. Main concerns are around token expiry and test coverage for the error path.*
````

#### Phase 3e — Optional Submit as PENDING

If `submit: true` in input:

1. POST to `https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}/reviews`
2. Payload: `{ commit_id, comments }` — exactly 2 keys (matches GitHub API requirement)
3. Verify response `state === "PENDING"` (user submits via GitHub UI)
4. Return `review_url` from response
5. If `state !== "PENDING"`, return error

**Never auto-approve or auto-submit final review. User always clicks submit in GitHub UI.**

**Steps:**

1. Write `diff-parser.ts`
2. Write `validator.ts`
3. Write `markdown-formatter.ts`
4. Write `prompts.ts` (adapted from `review-pr.md`)
5. Write `handler.ts` orchestrating all above
6. Write `agent-card.json`
7. Write `trigger.ts` with a real test PR URL
8. Test end-to-end: diff parsing → annotated diff → LLM → validation → markdown

**Deliverables:** Live `github_code_reviewer` agent. Input: PR URL. Output: line-aware review + optional PENDING submission.

---

### Phase 4 — Polish & Hardening (2-3h)

| Task               | Detail                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming progress | Use `ctx.reportStatus()` to emit multi-step progress: "Fetching PR...", "Parsing diff...", "Reviewing with AI...", "Validating comments..." |
| Input validation   | Add Zod schemas for all agent inputs — return clean errors on bad input                                                                     |
| Error handling     | LLM rate limits, invalid PR URLs, oversized diffs (>100KB — truncate with warning), GitHub 404s                                             |
| Model fallback     | If paid model fails, retry with free tier                                                                                                   |
| Test all samples   | Run all agents with edge cases: empty notes, PRs with only deletions, binary files in diff                                                  |
| README per agent   | Short doc per agent explaining input/output and how to test                                                                                 |

---

### Phase 5 — A2A Orchestrator (2-3h)

**Goal:** Demonstrate Blocks' core differentiator — agents composing other agents.

**Input schema:**

```json
{
  "pull_request_url": "https://github.com/org/repo/pull/123",
  "context": "string (optional)"
}
```

**Flow inside handler:**

```
1. Fetch PR diff + commit_id via Octokit (once)
2. In parallel via ctx.taskClient.sendMessage:
   a. Send to github_code_reviewer:
      { pull_request_url, context }
      → returns full engineering review
   b. Send to code_explainer:
      { code: diff_text, context: "GitHub PR diff — explain for a PM" }
      → returns non_technical section
3. Combine results via SYNTHESIS_PROMPT into unified output
```

**Output schema:**

```json
{
  "pr_url": "string",
  "engineering_review": {
    "summary": "...",
    "risk_level": "...",
    "top_issues": ["top 3 from reviewer"],
    "review_comment_markdown": "..."
  },
  "pm_briefing": {
    "plain_english_summary": "...",
    "business_value": "...",
    "risks_or_unknowns": ["..."],
    "questions_for_engineering": ["..."]
  },
  "combined_markdown": "## PR Briefing\n\n### Engineering\n...\n\n### For PMs\n..."
}
```

**Why this is the Blocks demo:**
One call produces output from two independent agents — one focused on code correctness, one on human readability. Neither agent was modified to support this composition. It just works because they're both on the network.

**Steps:**

1. Write `agents/pr-briefing-orchestrator/handler.ts`
2. Write `prompts.ts` (synthesis step only)
3. Write `agent-card.json`
4. Write `trigger.ts`
5. Test end-to-end with a real PR

**Deliverables:** Live `pr_briefing_orchestrator` that fans out to 2 agents and synthesizes.

---

### Phase 6 — Deferred (not in scope)

| Feature                      | Notes                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| JIRA integration             | Port from `review-pr.md` — fetch ticket, cross-check PR against acceptance criteria |
| Auto-post non-PENDING review | Needs explicit decision — risk of bad reviews going live                            |
| Webhook triggers             | Trigger review automatically on PR open/push                                        |
| Slack `/review` command      | Good for org adoption                                                               |
| GitHub App auth              | Replace PAT with App installation token for production                              |
| Web UI                       | Next.js front-end calling agents — deferred until agents are stable                 |

---

## Key Architecture Decisions

| Decision                        | Choice                                             | Rationale                                                          |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| Models — agents 1, 2, 4         | `deepseek/deepseek-v4-flash:free`                  | Free tier, 1M context, fast                                        |
| Model — agent 3 (code reviewer) | `deepseek/deepseek-v4-flash` (paid)                | Review accuracy worth ~$0.005/call                                 |
| Prompt storage                  | `prompts.ts` per agent                             | Type-safe, editable independently, not visible to Blocks           |
| Line validation strategy        | Strict — drop invalid comments                     | Safest, no hallucinated line references                            |
| GitHub auth                     | Personal Access Token (PAT)                        | Simplest for POC; migrate to GitHub App for production             |
| Diff annotation                 | Prefix each line with `[FILE:path L# SIDE]`        | Anchors LLM to real line numbers, reduces hallucination            |
| Orchestrator diff fetch         | Fetch once, pass to both sub-agents                | Pragmatic — 1 GitHub API call, cleaner than each agent re-fetching |
| Auto-submit                     | PENDING only — user must click submit in GitHub UI | Matches `review-pr.md` safety model                                |
| JSON extraction                 | Try/catch + markdown fence stripping               | LLMs sometimes wrap JSON in ``` blocks                             |

---

## Time Estimates

| Phase                | Hours | Cumulative |
| -------------------- | ----- | ---------- |
| 0 — Foundation       | 1-2h  | 2h         |
| 1 — Code Explainer   | 2-3h  | 5h         |
| 2 — Meeting Notes    | 1-2h  | 7h         |
| 3 — GitHub Reviewer  | 5-7h  | 14h        |
| 4 — Polish           | 2-3h  | 17h        |
| 5 — A2A Orchestrator | 2-3h  | 20h        |

MVP (Phases 0-3): ~14h across 2-3 sessions
Full build (Phases 0-5): ~20h across 3-4 sessions

---

## Testing Strategy

### Per agent

1. `blocks check` — validate agent-card.json
2. `blocks publish` — register on network
3. `blocks run` — start agent
4. `npx tsx trigger.ts` — run test input, verify output
5. Blocks dashboard — manual testing via UI

### Code reviewer edge cases to test

- PR with only additions (no deletions)
- PR with only deletions
- Large PR (many files, 50+ lines changed)
- Private repo (requires GITHUB_TOKEN with repo scope)
- Draft PR
- PR with binary files in diff (should skip gracefully)

---

## Open Questions / Risks

| Risk                                            | Mitigation                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| LLM returns malformed JSON                      | `json-extract.ts` + try/catch + retry once                            |
| LLM hallucinates line numbers                   | `validator.ts` drops all invalid references                           |
| Diff too large for context window               | Truncate to 100KB with warning via `ctx.reportStatus`                 |
| GitHub token lacks required scope               | Clear error message with required scopes listed                       |
| DeepSeek V4 Flash rate limits on free tier      | Retry with 1s backoff, surface warning                                |
| `blocks publish` requires restart after changes | Document in README: always re-publish + restart after handler changes |
