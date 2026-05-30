import type { HandlerResult, StartTaskMessage, TaskContext } from "@blocks-network/sdk";
import { generateObject } from "ai";
import { ResultAsync, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import { fetchPRDiff, fetchPRHeadSha, parsePRUrl } from "../../lib/github.js";
import { model } from "../../lib/openrouter.js";
import { parsePRDiff } from "./diff-parser.js";
import { formatMarkdown } from "./markdown-formatter.js";
import { SYSTEM_PROMPT, buildAnnotatedDiffPrompt } from "./prompts.js";
import { validateComments } from "./validator.js";

const InputSchema = z.object({
  pull_request_url: z.string().url(),
  context: z.string().optional(),
  submit: z.boolean().default(false),
});

const CommentSchema = z.object({
  path: z.string(),
  line: z.number().int().positive(),
  side: z.enum(["RIGHT", "LEFT"]),
  severity: z.enum(["low", "medium", "high"]),
  category: z.enum(["security", "performance", "correctness", "design", "style"]),
  body: z.string(),
});

const ReviewSchema = z.object({
  summary: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
  comments: z.array(CommentSchema),
  general_feedback: z.string(),
});

export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  const part = task.requestParts?.[0] as { text?: string } | string | undefined;
  const raw = typeof part === "string" ? part : (part?.text ?? "{}");
  const input = InputSchema.parse(JSON.parse(raw));

  const { pull_request_url, context, submit } = input;
  const { owner, repo, pull_number } = parsePRUrl(pull_request_url);

  const result = await safeTry(async function* () {
    ctx?.reportStatus("Fetching PR diff...");
    const [diff, commitId] = yield* ResultAsync.fromPromise(
      Promise.all([
        fetchPRDiff(owner, repo, pull_number),
        fetchPRHeadSha(owner, repo, pull_number),
      ]),
      (e) => new Error(`GitHub fetch failed: ${e}`),
    );

    ctx?.reportStatus("Parsing diff...");
    const { annotatedDiff, validLineRanges } = parsePRDiff(diff);

    ctx?.reportStatus("Reviewing with AI...");
    const { object: review } = yield* ResultAsync.fromPromise(
      generateObject({
        model,
        schema: ReviewSchema,
        mode: "json",
        system: SYSTEM_PROMPT,
        prompt: buildAnnotatedDiffPrompt({ annotatedDiff, context }),
      }),
      (e) => new Error(`LLM review failed: ${e}`),
    );

    ctx?.reportStatus("Validating line references...");
    const { valid: validComments, droppedCount } = validateComments(review.comments, validLineRanges);

    if (droppedCount > 0) {
      ctx?.reportStatus(`Dropped ${droppedCount} comment(s) with invalid line references.`);
    }

    const reviewMarkdown = formatMarkdown(validComments, {
      prUrl: pull_request_url,
      prNumber: pull_number,
      summary: review.summary,
      riskLevel: review.risk_level,
      generalFeedback: review.general_feedback,
    });

    const githubPayload = {
      commit_id: commitId,
      comments: validComments.map((c) => ({
        path: c.path,
        line: c.line,
        side: c.side,
        body: c.body,
      })),
    };

    let submitted = false;
    let reviewUrl: string | null = null;

    if (submit && validComments.length > 0) {
      ctx?.reportStatus("Creating PENDING review on GitHub...");
      const { Octokit } = await import("@octokit/rest");
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

      const reviewResponse = yield* ResultAsync.fromPromise(
        octokit.pulls.createReview({
          owner,
          repo,
          pull_number,
          commit_id: commitId,
          comments: githubPayload.comments,
        }),
        (e) => new Error(`GitHub submit failed: ${e}`),
      );

      submitted = true;
      reviewUrl = (reviewResponse.data as { html_url?: string }).html_url ?? null;
    }

    return okAsync({
      pr_url: pull_request_url,
      summary: review.summary,
      risk_level: review.risk_level,
      comments: validComments,
      general_feedback: review.general_feedback,
      review_comment_markdown: reviewMarkdown,
      github_payload: githubPayload,
      submitted,
      review_url: reviewUrl,
    });
  });

  if (result.isErr()) throw result.error;

  return {
    artifacts: [{ data: JSON.stringify(result.value, null, 2), mimeType: "application/json" }],
  };
}
