import { sign, newTid, verify } from '../mcp/token.mjs';
import { createEngram } from '../mcp/engram-core.mjs';

const SECRET = 'test-signing-secret-for-isolation';

// Mock storage backend
function makeMockBackend() {
  const store = new Map();
  return {
    kind: 'mock',
    remember: async (ns, text) => {
      const list = store.get(ns) || [];
      const mem = { text, ns, blobId: 'mock-blob-id', ts: Date.now() };
      list.push(mem);
      store.set(ns, list);
      return 'mock-blob-id';
    },
    recall: async (ns, query) => {
      const list = store.get(ns) || [];
      return list.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()));
    },
  };
}

async function testIsolation() {
  console.log('[test] 1. Token signing and verification...');
  const tidA = newTid();
  const tidB = newTid();
  const tokenA = sign(tidA, SECRET);
  const tokenB = sign(tidB, SECRET);

  const payloadA = verify(tokenA, SECRET);
  const payloadB = verify(tokenB, SECRET);
  if (!payloadA || payloadA.tid !== tidA) throw new Error('Token A failed verification');
  if (!payloadB || payloadB.tid !== tidB) throw new Error('Token B failed verification');

  console.log('[test] 2. Tenant isolation in lockNamespace...');
  const slug = (r) => String(r || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';
  const roomNs = (room, tid) => (tid ? `team:${tid}:${slug(room)}` : `team:${slug(room)}`);

  const nsA = roomNs('demo', payloadA.tid);
  const nsB = roomNs('demo', payloadB.tid);
  const nsLegacy = roomNs('demo', null);

  console.log('nsA:', nsA);
  console.log('nsB:', nsB);
  console.log('nsLegacy:', nsLegacy);

  if (nsA === nsB || nsA === nsLegacy || nsB === nsLegacy) {
    throw new Error('Namespaces should be distinct!');
  }

  const backend = makeMockBackend();
  const serverA = createEngram({ backend, lockNamespace: nsA });
  const serverB = createEngram({ backend, lockNamespace: nsB });
  const serverLegacy = createEngram({ backend, lockNamespace: nsLegacy });

  // Remember in Tenant A
  await serverA.handleTool('engram_remember', {
    text: 'Tenant A secret plan: build flying cars',
    type: 'plan',
  });

  // Remember in Legacy
  await serverLegacy.handleTool('engram_remember', {
    text: 'Legacy self-host data',
    type: 'config',
  });

  // Recall in Tenant B (should be empty)
  const recallB = await serverB.handleTool('engram_recall', { query: 'flying cars' });
  console.log('Tenant B recall result:', recallB);
  if (recallB.includes('Tenant A secret plan')) {
    throw new Error('Leak detected! Tenant B should not see Tenant A memories.');
  }

  // Recall in Tenant A (should find memory)
  const recallA = await serverA.handleTool('engram_recall', { query: 'flying cars' });
  console.log('Tenant A recall result:', recallA);
  if (!recallA.includes('Tenant A secret plan')) {
    throw new Error('Tenant A failed to recall own memory.');
  }

  // Recall in Legacy
  const recallLegacy = await serverLegacy.handleTool('engram_recall', { query: 'Legacy self-host' });
  console.log('Legacy recall result:', recallLegacy);
  if (!recallLegacy.includes('Legacy self-host data')) {
    throw new Error('Legacy server failed to recall legacy data.');
  }

  console.log('✅ ALL MULTI-TENANT ISOLATION TESTS PASSED!');
}

testIsolation().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
