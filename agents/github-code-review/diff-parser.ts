import parseDiff from "parse-diff";

export type LineRange = { start: number; end: number; side: "RIGHT" | "LEFT" };
export type ValidLineRanges = Record<string, LineRange[]>;

export type ParsedDiff = {
  annotatedDiff: string;
  validLineRanges: ValidLineRanges;
};

const MAX_DIFF_BYTES = 100_000;

export function parsePRDiff(rawDiff: string): ParsedDiff {
  const truncated =
    rawDiff.length > MAX_DIFF_BYTES
      ? rawDiff.slice(0, MAX_DIFF_BYTES) + "\n[DIFF TRUNCATED — too large]"
      : rawDiff;

  const files = parseDiff(truncated);
  const validLineRanges: ValidLineRanges = {};
  const annotatedLines: string[] = [];

  for (const file of files) {
    if (!file.to || file.to === "/dev/null") continue;
    const path = file.to;
    validLineRanges[path] = [];

    for (const chunk of file.chunks) {
      let minRight = Infinity;
      let maxRight = -Infinity;
      let minLeft = Infinity;
      let maxLeft = -Infinity;

      for (const change of chunk.changes) {
        if (change.type === "add") {
          const line = change.ln;
          minRight = Math.min(minRight, line);
          maxRight = Math.max(maxRight, line);
          annotatedLines.push(`[FILE:${path} L${line} RIGHT] ${change.content}`);
        } else if (change.type === "del") {
          const line = change.ln;
          minLeft = Math.min(minLeft, line);
          maxLeft = Math.max(maxLeft, line);
          annotatedLines.push(`[FILE:${path} L${line} LEFT] ${change.content}`);
        } else {
          // normal context line — valid on both sides
          const rightLine = change.ln2;
          const leftLine = change.ln1;
          minRight = Math.min(minRight, rightLine);
          maxRight = Math.max(maxRight, rightLine);
          minLeft = Math.min(minLeft, leftLine);
          maxLeft = Math.max(maxLeft, leftLine);
          annotatedLines.push(`[FILE:${path} L${rightLine} RIGHT] ${change.content}`);
        }
      }

      if (maxRight >= minRight) {
        validLineRanges[path].push({ start: minRight, end: maxRight, side: "RIGHT" });
      }
      if (maxLeft >= minLeft) {
        validLineRanges[path].push({ start: minLeft, end: maxLeft, side: "LEFT" });
      }
    }
  }

  return { annotatedDiff: annotatedLines.join("\n"), validLineRanges };
}
