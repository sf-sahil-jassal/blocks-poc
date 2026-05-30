import type { ReviewComment } from "./validator.js";

const SEVERITY_EMOJI: Record<ReviewComment["severity"], string> = {
  high: "🔴",
  medium: "🟠",
  low: "🟡",
};

const RISK_LABEL: Record<string, string> = {
  low: "🟢 Low",
  medium: "🟠 Medium",
  high: "🔴 High",
};

export type FormatOptions = {
  prUrl: string;
  prNumber: number;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  generalFeedback: string;
};

export function formatMarkdown(
  comments: ReviewComment[],
  opts: FormatOptions,
): string {
  const byFile: Record<string, ReviewComment[]> = {};
  for (const c of comments) {
    (byFile[c.path] ??= []).push(c);
  }

  const fileCount = Object.keys(byFile).length;
  const lines: string[] = [
    `## Code Review — PR #${opts.prNumber}`,
    ``,
    `**Risk:** ${RISK_LABEL[opts.riskLevel]} | **Files reviewed:** ${fileCount} | **Comments:** ${comments.length}`,
    ``,
    `### Summary`,
    opts.summary,
    ``,
  ];

  for (const [path, fileComments] of Object.entries(byFile)) {
    const sorted = [...fileComments].sort((a, b) => a.line - b.line);
    lines.push(`### \`${path}\``);
    for (const c of sorted) {
      lines.push(
        `- **L${c.line} ${c.side} — ${SEVERITY_EMOJI[c.severity]} ${capitalize(c.category)}: ${extractTitle(c.body)}**`,
      );
      lines.push(`  ${extractIssue(c.body)}`);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*${opts.generalFeedback}*`);

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Extracts the title from "**CATEGORY: TITLE**" bold format
function extractTitle(body: string): string {
  const match = body.match(/\*\*[^:]+:\s*([^*]+)\*\*/);
  return match ? match[1].trim() : body.split("\n")[0].replace(/[*#]/g, "").trim();
}

// Extracts first sentence of the Issue section
function extractIssue(body: string): string {
  const match = body.match(/\*\*Issue:\*\*\s*(.+?)(?:\n|$)/);
  return match ? match[1].trim() : "";
}
