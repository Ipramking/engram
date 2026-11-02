// Dependency-free shared types for Engram 2.0 Intelligence & Storage
export const MEMORY_TYPES = [
  "decision",
  "config",
  "gotcha",
  "person",
  "preference",
  "plan",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_CATEGORIES = [
  "episodic",    // events, conversation summaries, session occurrences
  "semantic",    // facts, config values, domain knowledge
  "procedural",  // workflows, preferences, gotchas, instructions
  "project",     // decisions, architecture, progress, plans
  "relational",  // people, teams, contacts, entity relationships
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
