import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const transport = new StreamableHTTPClientTransport(new URL('http://localhost:8788/mcp?token=engram-test-123&room=sui-lagos'));
const client = new Client({ name: 't', version: '1' });
await client.connect(transport);
const r = await client.callTool({ name: 'engram_remember', arguments: { text: 'The Engram team endpoint is hosted for shared memory, set up 2026-08-27.', type: 'decision' } });
console.log('REMEMBER:', r.content[0].text);
await client.close();
