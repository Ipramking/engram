import 'dotenv/config';
import { MemWal } from '@mysten-incubation/memwal';

const mem = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: process.env.MEMWAL_SERVER_URL,
  namespace: 'me',
});

console.log('relayer:', process.env.MEMWAL_SERVER_URL);
console.log('health:', JSON.stringify(await mem.health()));

const fact =
  '[decision] Engram uses Walrus Memory for portable agent memory, chosen 2026-08-27 at SuiHub Lagos.';
console.log('\nstoring:', fact);
const job = await mem.rememberAndWait(fact, undefined, { timeoutMs: 90_000 });
console.log('REMEMBER RESULT:', JSON.stringify(job, null, 2));

const r = await mem.recall({ query: 'what memory layer does Engram use?', topK: 5, maxDistance: 0.7 });
console.log('\nRECALL:', JSON.stringify(r.results ?? r, null, 2));
