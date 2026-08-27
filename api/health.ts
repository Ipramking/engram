// Lightweight status for the web demo badge — env-only, no Walrus SDK import.
const env = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

export default async function handler(_req: any, res: any) {
  const mock = Boolean(env.ENGRAM_USE_MOCK) || !env.MEMWAL_PRIVATE_KEY;
  res.status(200).json({ mock, llm: Boolean(env.GROQ_API_KEY) });
}
