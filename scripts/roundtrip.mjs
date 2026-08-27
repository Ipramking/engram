// Proves the Walrus Memory remember -> recall loop with zero credentials,
// using the SDK's built-in offline mock. Run: `node scripts/roundtrip.mjs`
import { MemWalMock } from "@mysten-incubation/memwal";

const memwal = MemWalMock.create({ namespace: "engram-smoke" });

console.log("health:", await memwal.health?.().catch(() => "n/a"));

const facts = [
  "We moved the DB to Neon Postgres on 2026-08-03 because the Render free tier expired.",
  "DATABASE_URL is set in the Render dashboard env, not in .env.",
  "Ada leads frontend, prefers Tailwind, timezone WAT.",
];

for (const f of facts) {
  const job = await memwal.rememberAndWait(f);
  console.log("remembered ->", JSON.stringify(job));
}

const q = "what's my database setup?";
const res = await memwal.recall({ query: q, topK: 5 });
console.log(`\nrecall("${q}") ->`);
for (const r of res.results ?? res) {
  console.log("  •", r.text ?? JSON.stringify(r));
}
