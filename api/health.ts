// Status endpoint — tells the UI whether we're on the real relayer or the mock,
// and whether an LLM is wired up.
import { memwalFor, isMock } from "./_lib/memwal";
import { llmEnabled } from "./_lib/llm";

export default async function handler(_req: any, res: any) {
  let health: any = null;
  try {
    health = (await memwalFor("personal").health?.()) ?? null;
  } catch (e) {
    health = { error: String(e) };
  }
  res.status(200).json({ mock: isMock(), llm: llmEnabled(), health });
}
