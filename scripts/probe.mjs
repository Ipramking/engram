import { MemWalMock } from "@mysten-incubation/memwal";
const m = MemWalMock.create({ namespace: "probe" });
await m.rememberAndWait("[decision] We moved the DB to Neon Postgres today because the Render free tier expired.");
await m.rememberAndWait("[config] DATABASE_URL is set in the Render dashboard env, not in .env.");
for (const q of ["database setup","DB Neon","deploy"]) {
  const r = await m.recall({ query: q, topK: 5, maxDistance: 0.7 });
  const all = await m.recall({ query: q, topK: 5 });
  console.log(`Q="${q}"  withThreshold0.7=${(r.results??r).length}  noThreshold dists=[${(all.results??all).map(x=>x.distance?.toFixed(2)).join(", ")}]`);
}
