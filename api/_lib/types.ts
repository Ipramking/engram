// Dependency-free shared types, so the LLM answer function doesn't bundle the
// Walrus SDK.
export const MEMORY_TYPES = [
  "decision",
  "config",
  "gotcha",
  "person",
  "preference",
  "plan",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
