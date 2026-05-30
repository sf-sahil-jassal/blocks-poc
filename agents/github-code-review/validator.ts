import type { ValidLineRanges } from "./diff-parser.js";

export type ReviewComment = {
  path: string;
  line: number;
  side: "RIGHT" | "LEFT";
  severity: "low" | "medium" | "high";
  category: "security" | "performance" | "correctness" | "design" | "style";
  body: string;
};

export function validateComments(
  comments: ReviewComment[],
  validLineRanges: ValidLineRanges,
): { valid: ReviewComment[]; droppedCount: number } {
  const valid: ReviewComment[] = [];
  let droppedCount = 0;

  for (const comment of comments) {
    const ranges = validLineRanges[comment.path];
    if (!ranges) {
      droppedCount++;
      continue;
    }

    const inRange = ranges.some(
      (r) => r.side === comment.side && comment.line >= r.start && comment.line <= r.end,
    );

    if (inRange) {
      valid.push(comment);
    } else {
      droppedCount++;
    }
  }

  return { valid, droppedCount };
}
