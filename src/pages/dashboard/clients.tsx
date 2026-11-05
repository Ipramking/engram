import type { ReactNode } from 'react'

export interface ConnectCtx {
  url: string
  maskedUrl: string
  token: string
  maskedToken: string
  origin: string
  prompt: string
  pack: string
  chatInstructions: string
  maskedChatInstructions: string
}

export interface Snippet {
  label: string
  display: string
  value: string
  wrap?: boolean
}

export type ClientGroup = 'chat' | 'desktop' | 'terminal' | 'automation'

export interface Client {
  id: string
  name: string
  group: ClientGroup
  tagline: string
  platforms: string[]
  method: string
  /** What the AI can do once connected. */
  reads: boolean
  writes: boolean
  steps: (c: ConnectCtx) => ReactNode[]
  snippets?: (c: ConnectCtx) => Snippet[]
  links?: Array<{ label: string; href: string }>
  verify: ReactNode
  note?: ReactNode
}

export const GROUPS: Array<{ id: ClientGroup; label: string; hint: string }> = [
  { id: 'chat', label: 'Chat apps', hint: 'Web and phone' },
  { id: 'desktop', label: 'Desktop & IDEs', hint: 'Config file' },
  { id: 'terminal', label: 'Terminal agents', hint: 'One command' },
  { id: 'automation', label: 'Automations', hint: 'HTTP & SDK' },
]

const json = (o: unknown) => JSON.stringify(o, null, 2)

/** Remote-URL config, shown masked but copied in full. */
function urlConfig(label: string, build: (url: string) => unknown, c: ConnectCtx): Snippet {
  return { label, display: json(build(c.maskedUrl)), value: json(build(c.url)) }
}

const remoteViaNpx = (url: string) => ({ command: 'npx', args: ['-y', 'mcp-remote', url] })

const WINDOWS_NPX_TIP = (
  <>
    On Windows, if the server shows as failed, change <code>"command": "npx"</code> to <code>"command": "cmd"</code> and
    start <code>args</code> with <code>"/c", "npx"</code>. Node.js 18 or newer must be installed.
  </>
)

export const CLIENTS: Client[] = [
  /* ── Chat apps ── */
  {
    id: 'claude',
    name: 'Claude',
    group: 'chat',
    tagline: 'claude.ai, desktop app, iPhone & Android',
    platforms: ['Web', 'iOS', 'Android', 'Desktop'],
    method: 'Custom connector',
    reads: true,
    writes: true,
    steps: () => [
      <>Copy your <b>connection link</b> below.</>,
      <>On a computer, open <b>claude.ai → Settings → Connectors</b> and choose <b>Add custom connector</b>.</>,
      <>Name it <b>Engram</b>, paste the link as the server URL, and save. Leave the advanced OAuth fields empty — the key is already inside the link.</>,
      <>Start a chat, open the <b>tools</b> menu under the message box and switch <b>Engram</b> on.</>,
      <>Connectors you add on claude.ai appear automatically in the Claude desktop and phone apps signed in to the same account.</>,
    ],
    snippets: (c) => [{ label: 'Connection link', display: c.maskedUrl, value: c.url, wrap: true }],
    links: [{ label: 'Open Claude connectors', href: 'https://claude.ai/settings/connectors' }],
    verify: <>Ask Claude: <i>“Use Engram to recall what you know about my projects.”</i> It should call <code>engram_recall</code>.</>,
    note: <>Custom connectors depend on your Claude plan. If you can't add one, use the <b>Claude Desktop</b> config instead.</>,
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    group: 'chat',
    tagline: 'Developer-mode connector, or instructions on any plan',
    platforms: ['Web', 'iOS', 'Android'],
    method: 'Connector or instructions',
    reads: true,
    writes: true,
    steps: () => [
      <><b>Paid plans on the web:</b> open <b>Settings → Apps &amp; Connectors → Advanced</b>, turn on <b>Developer mode</b>, then <b>Create</b> a connector named Engram with your connection link and <b>No authentication</b>.</>,
      <>In a chat, pick <b>Developer mode</b> from the <b>+</b> menu and enable Engram. ChatGPT can then save and recall directly.</>,
      <><b>Free plan or phone only:</b> copy the <b>custom instructions</b> below into <b>Settings → Personalization → Custom instructions</b>. ChatGPT will add a “Save to Engram” link when you say something worth keeping. Tap it, check the text, and press Save.</>,
      <>Starting a long chat? Paste the <b>memory pack</b> as your first message so ChatGPT knows your context.</>,
    ],
    snippets: (c) => [
      { label: 'Connection link (Developer mode)', display: c.maskedUrl, value: c.url, wrap: true },
      { label: 'Custom instructions (under 1,500 characters)', display: c.maskedChatInstructions, value: c.chatInstructions, wrap: true },
    ],
    verify: <>Say <i>“Remember that I deploy with Vercel.”</i> Then check that it appears under <b>Memories</b> here.</>,
    note: <>The instructions and save links contain your key. Use a dedicated key for ChatGPT so you can revoke it on its own. OpenAI renames these menus often.</>,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    group: 'chat',
    tagline: 'A Gem that knows your memory',
    platforms: ['Web', 'iOS', 'Android'],
    method: 'Gem instructions',
    reads: true,
    writes: true,
    steps: () => [
      <>Open <b>gemini.google.com/gems</b> (or the Gemini app → Gems) and create a new Gem named <b>Engram Brain</b>.</>,
      <>Paste the <b>instructions</b> below into the Gem's Instructions box and save. The Gem then appears in your Gemini app on every device.</>,
      <>The Gem reads a snapshot of your memory. When you tell it something new, it replies with a save link. Tap it and press Save.</>,
      <>Come back and copy fresh instructions now and then so the snapshot stays current.</>,
    ],
    snippets: (c) => [{ label: 'Gem instructions', display: c.maskedChatInstructions, value: c.chatInstructions, wrap: true }],
    links: [{ label: 'Open Gemini Gems', href: 'https://gemini.google.com/gems' }],
    verify: <>Ask the Gem about a project you've saved before. It should answer from your memories.</>,
    note: <>Gemini's consumer app can't call MCP tools, so it can't search your live memory. Gemini CLI can — see Terminal agents.</>,
  },
  {
    id: 'anychat',
    name: 'Any other chatbot',
    group: 'chat',
    tagline: 'DeepSeek, Grok, Perplexity, Meta AI…',
    platforms: ['Web', 'Phone'],
    method: 'Memory pack',
    reads: true,
    writes: true,
    steps: () => [
      <>Copy the <b>memory pack</b>: your active memories plus a rule for tap-to-save links.</>,
      <>Paste it as the first message of a new chat.</>,
      <>Whenever the assistant offers a save link, tap it and press Save. Nothing is stored until you confirm.</>,
    ],
    snippets: (c) => [{ label: 'Memory pack', display: c.pack.replace(c.token, '••••••'), value: c.pack, wrap: true }],
    verify: <>The assistant should answer questions about your projects without you re-explaining them.</>,
  },

  /* ── Desktop & IDEs ── */
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    group: 'desktop',
    tagline: 'Config file on macOS & Windows',
    platforms: ['macOS', 'Windows'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>In Claude Desktop open <b>Settings → Developer → Edit Config</b>. This opens <code>claude_desktop_config.json</code>.</>,
      <>Paste the config below. If the file already has <code>mcpServers</code>, add only the <code>engram</code> entry inside it.</>,
      <>Quit Claude completely (on Windows, from the tray icon) and reopen it.</>,
    ],
    snippets: (c) => [urlConfig('claude_desktop_config.json', (u) => ({ mcpServers: { engram: remoteViaNpx(u) } }), c)],
    verify: <>Open the tools menu in a chat. <b>engram</b> should be listed with its tools.</>,
    note: WINDOWS_NPX_TIP,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    group: 'desktop',
    tagline: 'Global or per-project MCP',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>Open <code>~/.cursor/mcp.json</code> (all projects) or <code>.cursor/mcp.json</code> in one project. Create it if it doesn't exist.</>,
      <>Paste the config below, merging with any existing <code>mcpServers</code>.</>,
      <>Open <b>Cursor Settings → Tools &amp; MCP</b>. Engram should show a green dot.</>,
    ],
    snippets: (c) => [urlConfig('~/.cursor/mcp.json', (u) => ({ mcpServers: { engram: { url: u } } }), c)],
    verify: <>In Agent chat, ask <i>“What does Engram know about this repo?”</i></>,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    group: 'desktop',
    tagline: 'GitHub Copilot agent mode',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>Create <code>.vscode/mcp.json</code> in your project, or run <b>MCP: Open User Configuration</b> from the Command Palette for all projects.</>,
      <>Paste the config below and click the <b>Start</b> link that appears above the server.</>,
      <>In Copilot Chat switch to <b>Agent</b> mode and enable the Engram tools.</>,
    ],
    snippets: (c) => [urlConfig('.vscode/mcp.json', (u) => ({ servers: { engram: { type: 'http', url: u } } }), c)],
    verify: <>The tools picker in Copilot Chat lists <code>engram_recall</code> and <code>engram_remember</code>.</>,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    group: 'desktop',
    tagline: 'Cascade MCP servers',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>Open <code>~/.codeium/windsurf/mcp_config.json</code> (Cascade → MCP servers → <b>View raw config</b>).</>,
      <>Paste the config below and press <b>Refresh</b> in the MCP panel.</>,
    ],
    snippets: (c) => [urlConfig('mcp_config.json', (u) => ({ mcpServers: { engram: { serverUrl: u } } }), c)],
    verify: <>Cascade's MCP panel shows Engram with its tools enabled.</>,
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    group: 'desktop',
    tagline: "Google's agent IDE",
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>In the Agent panel open the <b>…</b> menu → <b>MCP Servers → Manage MCP Servers → View raw config</b>.</>,
      <>Paste the config below into <code>mcp_config.json</code>, merging with existing servers, then refresh.</>,
    ],
    snippets: (c) => [urlConfig('mcp_config.json', (u) => ({ mcpServers: { engram: remoteViaNpx(u) } }), c)],
    verify: <>Ask the agent to recall your preferences. It should call Engram.</>,
    note: WINDOWS_NPX_TIP,
  },

  /* ── Terminal agents ── */
  {
    id: 'claude-code',
    name: 'Claude Code',
    group: 'terminal',
    tagline: 'One command, every project',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'CLI command',
    reads: true,
    writes: true,
    steps: () => [
      <>Run the command below once. <code>--scope user</code> makes Engram available in every project.</>,
      <>Check it with <code>claude mcp list</code>. Engram should say <b>Connected</b>.</>,
      <>Optional: paste the memory rules into <code>~/.claude/CLAUDE.md</code> so Claude saves decisions without being asked.</>,
    ],
    snippets: (c) => [
      {
        label: 'Terminal',
        display: `claude mcp add --transport http --scope user engram "${c.maskedUrl}"`,
        value: `claude mcp add --transport http --scope user engram "${c.url}"`,
        wrap: true,
      },
    ],
    verify: <>Inside a session run <code>/mcp</code>. Engram is listed with its tools.</>,
    note: <>Set up Engram before November 2026 with <code>--key=…</code>? Remove that entry first (<code>claude mcp remove engram</code>): version 0.1.0 of the package read a different store.</>,
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    group: 'terminal',
    tagline: 'settings.json entry',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>Open <code>~/.gemini/settings.json</code> (create it if needed).</>,
      <>Add the <code>engram</code> entry under <code>mcpServers</code> and restart Gemini CLI.</>,
    ],
    snippets: (c) => [urlConfig('~/.gemini/settings.json', (u) => ({ mcpServers: { engram: { httpUrl: u } } }), c)],
    verify: <>Run <code>/mcp</code> inside Gemini CLI. Engram should be listed as ready.</>,
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    group: 'terminal',
    tagline: 'config.toml entry',
    platforms: ['macOS', 'Windows', 'Linux'],
    method: 'Config file',
    reads: true,
    writes: true,
    steps: () => [
      <>Open <code>~/.codex/config.toml</code>.</>,
      <>Append the block below and restart Codex.</>,
    ],
    snippets: (c) => [
      {
        label: '~/.codex/config.toml',
        display: `[mcp_servers.engram]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${c.maskedUrl}"]`,
        value: `[mcp_servers.engram]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${c.url}"]`,
      },
    ],
    verify: <>Ask Codex to list its MCP tools. The Engram tools should appear.</>,
    note: WINDOWS_NPX_TIP,
  },
  {
    id: 'any-mcp',
    name: 'Any MCP client',
    group: 'terminal',
    tagline: 'Streamable HTTP or stdio',
    platforms: ['Any'],
    method: 'URL or command',
    reads: true,
    writes: true,
    steps: () => [
      <>If the client accepts a <b>remote / HTTP</b> server, give it the connection link.</>,
      <>If it only runs local commands (stdio), use <code>npx -y mcp-remote &lt;link&gt;</code> as the command.</>,
    ],
    snippets: (c) => [
      { label: 'Remote (Streamable HTTP)', display: c.maskedUrl, value: c.url, wrap: true },
      { label: 'Local command (stdio)', display: `npx -y mcp-remote "${c.maskedUrl}"`, value: `npx -y mcp-remote "${c.url}"`, wrap: true },
    ],
    verify: <>The client lists <code>engram_recall</code>, <code>engram_remember</code> and the other Engram tools.</>,
  },

  /* ── Automations ── */
  {
    id: 'shortcuts',
    name: 'Phone shortcuts',
    group: 'automation',
    tagline: 'iOS Shortcuts, Android HTTP Shortcuts',
    platforms: ['iOS', 'Android'],
    method: 'HTTP request',
    reads: false,
    writes: true,
    steps: () => [
      <>Create a shortcut with a <b>Get Contents of URL</b> action (iOS) or a new HTTP shortcut (Android).</>,
      <>Method <b>POST</b>, the URL below, a header <code>Authorization: Bearer &lt;key&gt;</code>, and a JSON body with <code>text</code> and <code>type</code>.</>,
      <>Feed the body from <b>Dictate Text</b> to save memories by voice.</>,
    ],
    snippets: (c) => [
      { label: 'Request', display: `POST ${c.origin}/api/remember\nAuthorization: Bearer ${c.maskedToken}\n\n{"text":"…","type":"decision","scope":"personal"}`, value: `POST ${c.origin}/api/remember\nAuthorization: Bearer ${c.token}\n\n{"text":"…","type":"decision","scope":"personal"}`, wrap: true },
    ],
    verify: <>Run the shortcut once, then refresh <b>Memories</b>.</>,
  },
  {
    id: 'python',
    name: 'Python SDK',
    group: 'automation',
    tagline: 'LangChain, CrewAI, AutoGen, scripts',
    platforms: ['Python 3.9+'],
    method: 'SDK',
    reads: true,
    writes: true,
    steps: () => [
      <>Install the SDK from the repository (it isn't on PyPI yet).</>,
      <>Set <code>ENGRAM_API_KEY</code> in your environment rather than in code.</>,
    ],
    snippets: (c) => [
      {
        label: 'Install',
        display: 'pip install "git+https://github.com/Ipramking/engram#subdirectory=packages/engram-py"',
        value: 'pip install "git+https://github.com/Ipramking/engram#subdirectory=packages/engram-py"',
        wrap: true,
      },
      {
        label: 'Use',
        display: `import os\nos.environ["ENGRAM_API_KEY"] = "${c.maskedToken}"\nos.environ["ENGRAM_HOST"] = "${c.origin}"\n\nfrom engram import remember, recall\nremember("Payments run on Paystack", type="decision")\nfor m in recall("payments provider"):\n    print(m.type, m.text)`,
        value: `import os\nos.environ["ENGRAM_API_KEY"] = "${c.token}"\nos.environ["ENGRAM_HOST"] = "${c.origin}"\n\nfrom engram import remember, recall\nremember("Payments run on Paystack", type="decision")\nfor m in recall("payments provider"):\n    print(m.type, m.text)`,
      },
    ],
    verify: <>The <code>recall</code> call prints the memory you just saved.</>,
  },
  {
    id: 'rest',
    name: 'REST API',
    group: 'automation',
    tagline: 'curl, n8n, Zapier, webhooks',
    platforms: ['Any'],
    method: 'HTTP',
    reads: true,
    writes: true,
    steps: () => [
      <>Send the key as a <code>Authorization: Bearer</code> header. Never put it in a public repo.</>,
      <><code>POST /api/remember</code> saves; <code>GET /api/recall?query=…</code> searches.</>,
    ],
    snippets: (c) => [
      {
        label: 'Save',
        display: `curl -X POST "${c.origin}/api/remember" \\\n  -H "Authorization: Bearer ${c.maskedToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Staging DB lives on Neon","type":"config"}'`,
        value: `curl -X POST "${c.origin}/api/remember" \\\n  -H "Authorization: Bearer ${c.token}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Staging DB lives on Neon","type":"config"}'`,
      },
      {
        label: 'Recall',
        display: `curl "${c.origin}/api/recall?query=staging%20database&format=text" \\\n  -H "Authorization: Bearer ${c.maskedToken}"`,
        value: `curl "${c.origin}/api/recall?query=staging%20database&format=text" \\\n  -H "Authorization: Bearer ${c.token}"`,
      },
    ],
    verify: <>The recall call returns the memory you saved.</>,
  },
]

/**
 * Key-free setup for apps that can run a local command: `npx engram-walrus login` saves a
 * per-device key once, so these configs contain no secret at all.
 */
const npxServer = { command: 'npx', args: ['-y', 'engram-walrus'] }
const plain = (label: string, text: string): Snippet => ({ label, display: text, value: text })

export const SIGN_IN_CONFIG: Record<string, Snippet> = {
  'claude-code': plain('Terminal', 'claude mcp add engram -s user -- npx -y engram-walrus'),
  'claude-desktop': plain('claude_desktop_config.json', json({ mcpServers: { engram: npxServer } })),
  cursor: plain('~/.cursor/mcp.json', json({ mcpServers: { engram: npxServer } })),
  vscode: plain('.vscode/mcp.json', json({ servers: { engram: { type: 'stdio', ...npxServer } } })),
  windsurf: plain('mcp_config.json', json({ mcpServers: { engram: npxServer } })),
  antigravity: plain('mcp_config.json', json({ mcpServers: { engram: npxServer } })),
  'gemini-cli': plain('~/.gemini/settings.json', json({ mcpServers: { engram: npxServer } })),
  codex: plain('~/.codex/config.toml', '[mcp_servers.engram]\ncommand = "npx"\nargs = ["-y", "engram-walrus"]'),
  'any-mcp': plain('Local command (stdio)', 'npx -y engram-walrus'),
}
