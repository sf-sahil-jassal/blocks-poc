// LLMs sometimes wrap JSON in markdown code fences. This handles both cases.
export function extractJSON<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned) as T;
}
