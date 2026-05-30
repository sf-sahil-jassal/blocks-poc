// LLMs sometimes wrap JSON in markdown code fences or add prose.
// Extract by finding the outermost { ... } or [ ... ] bounds.
export function extractJSON<T>(raw: string): T {
  const start = raw.search(/[{[]/);
  if (start === -1) throw new Error("No JSON object found in LLM response");

  const openChar = raw[start];
  const closeChar = openChar === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) throw new Error("Unbalanced JSON braces in LLM response");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
