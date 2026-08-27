import { createEngram } from '../mcp/engram-core.mjs';
const { handleTool } = createEngram({ backend: undefined, lockNamespace: 'team:retrytest' });
const t0 = Date.now();
const out = await handleTool('engram_remember', { text: 'Engram bridge now retries the first-call 401 automatically, added 2026-08-27.', type: 'gotcha' });
console.log(`(${((Date.now()-t0)/1000).toFixed(1)}s) ${out}`);
process.exit(0);
