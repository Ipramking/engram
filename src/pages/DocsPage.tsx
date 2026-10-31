import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, BookOpen, Terminal, Laptop, Smartphone, Users, Lock, Key, Shield,
  Check, Copy, ExternalLink, ArrowRight, ArrowLeft, Sparkles, Download, Layers,
  AlertCircle, FileText, Code2, Server, HelpCircle, ChevronRight, Search,
  Database, Network, Zap, Cpu, Hash, ShieldCheck, Flame, GitBranch, RefreshCw
} from 'lucide-react'
import { Wordmark, Nav, Footer } from '../components/Chrome'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'
import { useAuth } from '../context/AuthContext'

interface DocArticle {
  id: string
  category: string
  title: string
  badge?: string
  description: string
  toc: { id: string; label: string }[]
  content: React.ReactNode
}

export default function DocsPage() {
  const { user } = useAuth()
  const [activeArticleId, setActiveArticleId] = useState('intro')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(id)
    setTimeout(() => setCopiedSnippet(null), 2000)
  }

  // Articles Definition modeled after standard Web3 crypto project docs (Sui, Walrus, Uniswap)
  const articles: DocArticle[] = useMemo(() => [
    // ── 1. INTRODUCTION ──
    {
      id: 'intro',
      category: 'Overview',
      title: 'What is Engram?',
      badge: 'v0.1.0',
      description: 'Decentralized, verifiable persistent memory for autonomous AI agents built on Walrus and Sui.',
      toc: [
        { id: 'problem', label: 'The Agent Amnesia Problem' },
        { id: 'solution', label: 'The Engram Solution' },
        { id: 'why-walrus', label: 'Why Walrus & Sui?' },
        { id: 'architecture', label: 'High-Level Architecture' },
      ],
      content: (
        <div className="space-y-8">
          <p className="text-base text-mut leading-relaxed">
            <strong>Engram</strong> is an open-source decentralized memory layer that gives AI coding assistants, autonomous agents, and mobile chatbots a persistent, verifiable memory. It decouples memory from the ephemeral chat session and anchors it to decentralized storage.
          </p>

          <div id="problem" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">The Agent Amnesia Problem</h3>
            <p className="text-sm text-mut leading-relaxed">
              Modern AI agents are stateless. Every time you start a conversation in Cursor, Claude Desktop, or ChatGPT on your phone:
            </p>
            <ul className="space-y-2 text-sm text-mut">
              <li className="flex items-start gap-2">
                <span className="text-rose font-bold">•</span>
                <span><strong>Context window resets:</strong> Architectural choices, environment settings, and bug workarounds disappear.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose font-bold">•</span>
                <span><strong>Platform silos:</strong> Insights discovered on your phone do not carry over to your IDE or terminal.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose font-bold">•</span>
                <span><strong>Team duplication:</strong> Every engineer must separately explain team conventions and tech stacks to their own AI.</span>
              </li>
            </ul>
          </div>

          <div id="solution" className="scroll-mt-28 rounded-3xl border border-rose/30 bg-rose/[0.04] p-6 space-y-3">
            <div className="flex items-center gap-2 text-rose">
              <Sparkles size={18} />
              <h3 className="font-display text-lg text-txt">The Engram Solution</h3>
            </div>
            <p className="text-sm text-mut leading-relaxed">
              Engram introduces an external persistent memory substrate. When an agent discovers a durable fact (or when you explicitly command it to record a plan), it writes a cryptographically encrypted memory to Walrus. When starting any new session on any tool, the agent automatically executes semantic recall in under 200ms before generating a response.
            </p>
          </div>

          <div id="why-walrus" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Why Walrus & Sui?</h3>
            <p className="text-sm text-mut leading-relaxed">
              Unlike centralized vector databases (which are proprietary and vendor-locked) or local files (which cannot sync to your phone), Engram leverages <strong>Walrus</strong>:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-surface/30 p-4">
                <h4 className="font-semibold text-txt text-xs flex items-center gap-2 mb-1">
                  <Database size={15} className="text-rose" /> Decentralized & Censorship-Resistant
                </h4>
                <p className="text-xs text-mut">
                  Memories are partitioned into erasure-coded slivers across independent storage nodes. No single vendor controls your agent's knowledge.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface/30 p-4">
                <h4 className="font-semibold text-txt text-xs flex items-center gap-2 mb-1">
                  <ShieldCheck size={15} className="text-violet-soft" /> Sui On-Chain Verifiability
                </h4>
                <p className="text-xs text-mut">
                  Every memory generates an immutable Walrus Blob ID registered on the Sui blockchain, enabling independent verification via Walruscan.
                </p>
              </div>
            </div>
          </div>

          <div id="architecture" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">High-Level Architecture</h3>
            <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-5 font-mono text-xs text-txt leading-relaxed">
{`┌─────────────────────────────────────────────────────────────┐
│                    CONNECTED CLIENTS                        │
│   Cursor IDE   ·   Claude Desktop   ·   Mobile (iOS/Android)│
│               CLI (engram-walrus)   ·   Windsurf            │
└──────────────────────────────┬──────────────────────────────┘
                               │ MCP Protocol (HTTP SSE / stdio)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENGRAM ROUTING LAYER                     │
│  Personal Space (usr_<id>)   │   Team Space (team_<id>)     │
│  Daily Quota Enforcement     │   Role Access Validation     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Seal Threshold Encryption
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    WALRUS STORAGE NETWORK                   │
│   Decentralized Blobs   ·   Erasure Slivers   ·   Sui PoS   │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      ),
    },

    // ── 2. QUICKSTART ──
    {
      id: 'quickstart',
      category: 'Getting Started',
      title: 'Quickstart Guide',
      badge: '2 Min',
      description: 'Zero to persistent cross-platform memory in three simple steps.',
      toc: [
        { id: 'step-1', label: '1. Create Account & Mint Key' },
        { id: 'step-2', label: '2. Configure your AI Client' },
        { id: 'step-3', label: '3. Inject System Instructions' },
        { id: 'step-4', label: '4. Verify First Write' },
      ],
      content: (
        <div className="space-y-8">
          <p className="text-sm text-mut leading-relaxed">
            Follow this guide to connect Engram to your preferred AI environment (Cursor, Claude, or mobile) in under 2 minutes.
          </p>

          <div id="step-1" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15 text-rose text-xs font-mono">1</span>
              Create an Account & Mint an API Key
            </h3>
            <p className="text-xs text-mut">
              Navigate to <Link to="/register" className="text-rose underline">/register</Link> to start with a free Personal Plan (50 saves/day). Then visit the <strong>API Keys</strong> tab in your <Link to="/dashboard" className="text-rose underline">Dashboard</Link> and generate a personal key (<code className="font-mono text-rose">eng_usr_...</code>).
            </p>
          </div>

          <div id="step-2" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15 text-rose text-xs font-mono">2</span>
              Configure Your AI Client
            </h3>
            <p className="text-xs text-mut">
              Engram supports both remote Streamable HTTP MCP and local stdio CLI. Add the following to your client configuration:
            </p>

            <div className="rounded-2xl border border-line bg-bg/80 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-faint">claude_desktop_config.json / .cursor/mcp.json</span>
                <button
                  onClick={() =>
                    copy(
                      JSON.stringify(
                        {
                          mcpServers: {
                            engram: {
                              url: 'https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space',
                            },
                          },
                        },
                        null,
                        2
                      ),
                      'qs-conf'
                    )
                  }
                  className="flex items-center gap-1 font-mono text-xs text-rose hover:underline"
                >
                  {copiedSnippet === 'qs-conf' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedSnippet === 'qs-conf' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto font-mono text-xs text-txt">
{`{
  "mcpServers": {
    "engram": {
      "url": "https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space"
    }
  }
}`}
              </pre>
            </div>
          </div>

          <div id="step-3" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15 text-rose text-xs font-mono">3</span>
              Inject System Instructions
            </h3>
            <p className="text-xs text-mut">
              Instruct your agent to utilize Engram tools silently. Paste the official Engram prompt into your agent's custom instructions or system rules:
            </p>
            <button
              onClick={() => downloadText('engram-rules.txt', ENGRAM_PROMPT)}
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface/50 px-4 py-2.5 text-xs font-medium text-txt hover:border-rose/50 transition"
            >
              <Download size={14} className="text-rose" /> Download System Prompt (.txt)
            </button>
          </div>

          <div id="step-4" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15 text-rose text-xs font-mono">4</span>
              Verify First Write
            </h3>
            <p className="text-xs text-mut leading-relaxed">
              In your AI chat, say: <em className="text-txt">“Remember that our database is on Supabase with project ref lqscyshajhvzkusougpy.”</em><br />
              The agent will invoke <code className="font-mono text-rose">engram_remember</code>. Open a completely new session and ask: <em className="text-txt">“What is our DB setup?”</em> The agent will cite your previous decision immediately!
            </p>
          </div>
        </div>
      ),
    },

    // ── 3. WALRUS & CRYPTOGRAPHY ──
    {
      id: 'cryptography',
      category: 'Storage & Cryptography',
      title: 'Walrus Protocol & Seal',
      badge: 'Mainnet',
      description: 'How client-side encryption and decentralized storage guarantee privacy and verifiability.',
      toc: [
        { id: 'walrus-storage', label: 'Walrus Storage Mechanism' },
        { id: 'seal-encryption', label: 'Seal Cryptographic Privacy' },
        { id: 'sui-verification', label: 'Sui Blockchain Verification' },
        { id: 'epochs', label: 'Storage Epochs & Retention' },
      ],
      content: (
        <div className="space-y-8">
          <div id="walrus-storage" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Walrus Storage Mechanism</h3>
            <p className="text-sm text-mut leading-relaxed">
              Walrus is designed by Mysten Labs to store unstructured data blobs at massive scale and minimal cost. Instead of replicating full copies across hundreds of validators, Walrus employs <strong>RedStuff 2D erasure coding</strong>:
            </p>
            <div className="rounded-2xl border border-line bg-surface/20 p-4 text-xs text-mut space-y-2">
              <p>• A memory blob is partitioned into an array of small slivers.</p>
              <p>• Slivers are distributed across independent storage node committees.</p>
              <p>• The memory can be fully reconstructed even if up to one-third of storage nodes fail or go offline.</p>
            </div>
          </div>

          <div id="seal-encryption" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Seal Cryptographic Privacy</h3>
            <p className="text-sm text-mut leading-relaxed">
              Memories often contain sensitive architectural nuances, URLs, or internal references. Engram integrates <strong>Seal</strong> threshold encryption:
            </p>
            <div className="rounded-2xl border border-line glass p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose">
                <Shield size={16} />
                <h4 className="font-semibold text-xs text-txt uppercase tracking-wider font-mono">Zero Knowledge Relayer</h4>
              </div>
              <p className="text-xs text-mut leading-relaxed">
                Data is encrypted locally on the client with ephemeral public keys before leaving your machine. Storage node operators on Walrus cannot read the plaintext content of your memories. Only authenticated requests bearing your signed session token can decrypt payloads.
              </p>
            </div>
          </div>

          <div id="sui-verification" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Sui Blockchain Verification</h3>
            <p className="text-sm text-mut leading-relaxed">
              When a blob is certified on Walrus, its metadata and storage availability certificate are recorded on the <strong>Sui Mainnet</strong>.
            </p>
            <div className="rounded-2xl border border-line bg-bg/80 p-4">
              <p className="text-xs font-mono text-faint mb-2">Live Mainnet Blob Proof Example:</p>
              <div className="flex items-center justify-between font-mono text-xs text-txt bg-surface/50 p-2.5 rounded-xl">
                <span>2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI</span>
                <a
                  href="https://walruscan.com/mainnet/blob/2iD9wFtosZo0AwOEmEmHWyjWw6T_gOuY899xrqU2qdI"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-rose hover:underline"
                >
                  <span>Inspect on Walruscan</span> <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          <div id="epochs" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Storage Epochs & Retention</h3>
            <p className="text-sm text-mut leading-relaxed">
              On Walrus, storage is provisioned in <strong>Epochs</strong> (discrete multi-day intervals). Free tier accounts have memories stored for the standard hackathon lifecycle, while Pro accounts leverage staking pools for permanent, multi-epoch persistent storage.
            </p>
          </div>
        </div>
      ),
    },

    // ── 4. CORE PRIMITIVES & TAXONOMY ──
    {
      id: 'primitives',
      category: 'Core Concepts',
      title: 'Primitives & Memory Taxonomy',
      badge: 'Core',
      description: 'Personal vs. team memory isolation and the 6 signal memory types.',
      toc: [
        { id: 'taxonomy-breakdown', label: 'The 6 Signal Memory Types' },
        { id: 'personal-spaces', label: 'Personal Memory Spaces' },
        { id: 'team-spaces', label: 'Team Memory Spaces & Limits' },
      ],
      content: (
        <div className="space-y-8">
          <div id="taxonomy-breakdown" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">The 6 Signal Memory Types</h3>
            <p className="text-sm text-mut leading-relaxed">
              Engram explicitly prevents noisy conversational chatter from polluting memory. Every stored fact is classified into one of six structured types:
            </p>

            <div className="overflow-x-auto rounded-2xl border border-line glass">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface/40 font-mono uppercase text-[10px] text-faint">
                  <tr>
                    <th className="p-3">Type</th>
                    <th className="p-3">Definition</th>
                    <th className="p-3">Example Stored Sentence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-mut">
                  <tr>
                    <td className="p-3 font-mono font-bold text-rose">decision</td>
                    <td className="p-3">An architectural or design choice and its specific rationale.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“Moved DB to Neon on Aug 3 because Render free tier expired.”</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-sky-400">config</td>
                    <td className="p-3">Concrete setup values, ports, or where an env variable lives.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“DATABASE_URL is set in Render dashboard env, not .env.”</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-amber-400">gotcha</td>
                    <td className="p-3">Non-obvious pitfall, build bug, or tested platform workaround.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“supabase CLI has no win32 binary; use standalone .exe.”</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-rose-300">person</td>
                    <td className="p-3">Stable fact about a teammate, client, role, or timezone.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“Ada leads frontend, prefers Tailwind, is in WAT timezone.”</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-pink-400">preference</td>
                    <td className="p-3">Lasting user objective, styling rule, or workflow constraint.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“User wants every UI to work seamlessly on mobile and desktop.”</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-emerald-400">plan</td>
                    <td className="p-3">Multi-step spec, task list, or notes kept on user request.</td>
                    <td className="p-3 font-mono text-[11px] text-txt">“Our launch plan: 1) ship MCP, 2) test suite, 3) open signups.”</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="personal-spaces" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Personal Memory Spaces</h3>
            <p className="text-sm text-mut leading-relaxed">
              Personal memory is accessed via keys with prefix <code className="font-mono text-rose">eng_usr_...</code>. The storage namespace is locked to <code className="font-mono text-txt">usr_&lt;id&gt;</code>. These memories are strictly private and synchronized only across your own devices.
            </p>
          </div>

          <div id="team-spaces" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Team Memory Spaces & Limits</h3>
            <p className="text-sm text-mut leading-relaxed">
              Team spaces allow engineering pods to share common architectural decisions and conventions. Keys with prefix <code className="font-mono text-violet-soft">eng_team_...</code> map to namespace <code className="font-mono text-txt">team_&lt;id&gt;</code>.
            </p>
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
              <span className="font-bold">Strict Free Team Limit:</span> The Free Team Plan allows a maximum of 3 active team members. Adding a 4th member is blocked at the database level unless upgraded to Pro.
            </div>
          </div>
        </div>
      ),
    },

    // ── 5. PLATFORM INTEGRATIONS ──
    {
      id: 'integrations',
      category: 'Platform Guides',
      title: 'Client & Mobile Integrations',
      badge: 'Guides',
      description: 'Setup guides for Claude Desktop, Cursor, Mobile ChatGPT/Claude, and CLI.',
      toc: [
        { id: 'cursor-setup', label: 'Cursor IDE' },
        { id: 'claude-desktop', label: 'Claude Desktop' },
        { id: 'mobile-guide', label: 'Mobile Workflows (iOS/Android)' },
        { id: 'npm-package', label: 'CLI & NPM Package' },
      ],
      content: (
        <div className="space-y-8">
          <div id="cursor-setup" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <Laptop size={16} className="text-rose" /> Cursor Setup
            </h3>
            <p className="text-xs text-mut">
              Add the following block to <code className="font-mono">~/.cursor/mcp.json</code>:
            </p>
            <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-txt">
{`{
  "mcpServers": {
    "engram": {
      "url": "https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space"
    }
  }
}`}
            </pre>
          </div>

          <div id="claude-desktop" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <Laptop size={16} className="text-violet-soft" /> Claude Desktop Setup
            </h3>
            <p className="text-xs text-mut">
              Open <strong>Settings → Developer → Edit Config</strong> (<code className="font-mono">claude_desktop_config.json</code>) and add:
            </p>
            <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-txt">
{`{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engram-walrus", "--key=YOUR_API_KEY"]
    }
  }
}`}
            </pre>
          </div>

          <div id="mobile-guide" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <Smartphone size={16} className="text-emerald-400" /> Mobile Workflows (iOS & Android)
            </h3>
            <p className="text-xs text-mut leading-relaxed">
              Use Engram on mobile to capture brainstorms or voice notes during your commute and recall them when you return to your computer:
            </p>
            <div className="space-y-3 text-xs text-mut">
              <div className="rounded-2xl border border-line bg-surface/30 p-4">
                <p className="font-bold text-txt mb-1">Method 1: Custom GPTs / Instructions</p>
                <p>
                  Paste the Engram System Prompt in your mobile ChatGPT custom instructions and provide your API key. In Custom GPTs, add an Action with endpoint <code className="font-mono text-rose">/api/remember</code>.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface/30 p-4">
                <p className="font-bold text-txt mb-1">Method 2: iOS Shortcuts</p>
                <p>
                  Create an iOS Shortcut that sends highlighted text as JSON to <code className="font-mono text-rose">https://engram-mcp.onrender.com/api/remember</code> using header <code className="font-mono">Authorization: Bearer YOUR_KEY</code>.
                </p>
              </div>
            </div>
          </div>

          <div id="npm-package" className="scroll-mt-28 space-y-3">
            <h3 className="text-lg font-display text-txt flex items-center gap-2">
              <Terminal size={16} className="text-sky-400" /> CLI & NPM Package (engram-walrus)
            </h3>
            <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-txt leading-relaxed">
{`# Connect local terminal agent to cloud account
npx engram-walrus --key=eng_usr_YOUR_KEY

# Direct Walrus account browser sign-in
npx engram-walrus login

# Display CLI help
npx engram-walrus --help`}
            </pre>
          </div>
        </div>
      ),
    },

    // ── 6. PROTOCOL & API REFERENCE ──
    {
      id: 'api-reference',
      category: 'API Reference',
      title: 'MCP Tools & REST Protocol',
      badge: 'REST / MCP',
      description: 'Comprehensive endpoint reference, request/response schemas, and error codes.',
      toc: [
        { id: 'mcp-tools', label: 'MCP Tools Specification' },
        { id: 'rest-routes', label: 'REST API Endpoints' },
        { id: 'error-handling', label: 'Error Codes & Rate Limits' },
      ],
      content: (
        <div className="space-y-8">
          <div id="mcp-tools" className="scroll-mt-28 space-y-4">
            <h3 className="text-xl font-display text-txt">MCP Tools Specification</h3>

            <div className="rounded-2xl border border-line bg-surface/30 p-4 space-y-2">
              <p className="font-mono text-xs font-bold text-rose">engram_remember(text, type, scope?, team_code?)</p>
              <p className="text-xs text-mut">Stores one typed durable fact. Writes to Walrus and records blob ID.</p>
              <pre className="rounded-xl bg-bg/60 p-3 font-mono text-[11px] text-faint">
{`Input: { "text": "DATABASE_URL is in Render env", "type": "config", "scope": "personal" }
Output: "Remembered (config, scope=personal). Walrus blob: 2iD9wF..."`}
              </pre>
            </div>

            <div className="rounded-2xl border border-line bg-surface/30 p-4 space-y-2">
              <p className="font-mono text-xs font-bold text-violet-soft">engram_recall(query, scope?, team_code?)</p>
              <p className="text-xs text-mut">Semantic retrieval matching the meaning of the query against encrypted Walrus blobs.</p>
              <pre className="rounded-xl bg-bg/60 p-3 font-mono text-[11px] text-faint">
{`Input: { "query": "what is our db setup?", "scope": "personal" }
Output: "• (config) DATABASE_URL is in Render env  [blob 2iD9wF...]"`}
              </pre>
            </div>
          </div>

          <div id="rest-routes" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">REST API Endpoints</h3>
            <div className="overflow-x-auto rounded-2xl border border-line glass">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface/40 font-mono uppercase text-[10px] text-faint">
                  <tr>
                    <th className="p-3">Route</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Headers</th>
                    <th className="p-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-mut font-mono text-[11px]">
                  <tr>
                    <td className="p-3 text-txt">/api/remember</td>
                    <td className="p-3 text-rose font-bold">POST</td>
                    <td className="p-3">Authorization: Bearer &lt;key&gt;</td>
                    <td className="p-3 font-sans">Persist typed memory to Walrus.</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-txt">/api/recall</td>
                    <td className="p-3 text-rose font-bold">POST</td>
                    <td className="p-3">Authorization: Bearer &lt;key&gt;</td>
                    <td className="p-3 font-sans">Semantic vector memory search.</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-txt">/api/keys</td>
                    <td className="p-3 text-emerald-400 font-bold">GET/POST</td>
                    <td className="p-3">Authorization: Bearer &lt;jwt|key&gt;</td>
                    <td className="p-3 font-sans">Mint, list, and revoke API keys.</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-txt">/api/teams</td>
                    <td className="p-3 text-emerald-400 font-bold">GET/POST</td>
                    <td className="p-3">Authorization: Bearer &lt;jwt|key&gt;</td>
                    <td className="p-3 font-sans">Create spaces and invite teammates.</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-txt">/api/usage</td>
                    <td className="p-3 text-sky-400 font-bold">GET</td>
                    <td className="p-3">Authorization: Bearer &lt;jwt|key&gt;</td>
                    <td className="p-3 font-sans">Fetch daily quota stats vs plan limits.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="error-handling" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Error Codes & Rate Limits</h3>
            <div className="space-y-2 text-xs text-mut">
              <p>• <code className="font-mono text-txt">401 Unauthorized</code>: Missing or invalid API key / token.</p>
              <p>• <code className="font-mono text-txt">403 Forbidden</code>: Limit reached (e.g. Free Team Plan max 3 members ceiling).</p>
              <p>• <code className="font-mono text-txt">429 Too Many Requests</code>: Daily save quota reached (50/day personal, 150/day team). Resets at 00:00 UTC.</p>
            </div>
          </div>
        </div>
      ),
    },

    // ── 7. PLANS & LIMITS ──
    {
      id: 'plans',
      category: 'Billing & Tokenomics',
      title: 'Usage Quotas & Staking',
      badge: 'Quotas',
      description: 'Understanding free plan allowances, team member ceilings, and Pro capabilities.',
      toc: [
        { id: 'plan-matrix', label: 'Plan Comparison Matrix' },
        { id: 'quota-resets', label: 'Daily Quota Mechanics' },
      ],
      content: (
        <div className="space-y-8">
          <div id="plan-matrix" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Plan Comparison Matrix</h3>
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="rounded-2xl border border-line bg-surface/30 p-5">
                <span className="font-mono text-[10px] uppercase text-rose">Individual</span>
                <h4 className="font-display text-lg text-txt mt-1">Personal Free</h4>
                <p className="text-2xl font-bold font-mono text-txt my-2">$0</p>
                <ul className="space-y-2 text-mut">
                  <li>• 1 User Account</li>
                  <li>• <strong>50 saves / day</strong></li>
                  <li>• Cross-platform sync</li>
                  <li>• Seal client encryption</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-rose/40 bg-surface/50 p-5 shadow-lg shadow-rose/5">
                <span className="font-mono text-[10px] uppercase text-rose font-bold">Small Teams</span>
                <h4 className="font-display text-lg text-txt mt-1">Free Team Plan</h4>
                <p className="text-2xl font-bold font-mono text-txt my-2">$0</p>
                <ul className="space-y-2 text-mut">
                  <li className="text-txt font-semibold">• <strong>Strict max 3 members</strong></li>
                  <li>• <strong>150 shared saves / day</strong></li>
                  <li>• 1 Shared Team space</li>
                  <li>• Role access control</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-line bg-surface/30 p-5">
                <span className="font-mono text-[10px] uppercase text-violet-soft">Enterprise</span>
                <h4 className="font-display text-lg text-txt mt-1">Pro Tier</h4>
                <p className="text-2xl font-bold font-mono text-txt my-2">$29 <span className="text-xs font-normal text-faint">/ seat</span></p>
                <ul className="space-y-2 text-mut">
                  <li>• Unlimited members</li>
                  <li>• 2,000+ saves / day</li>
                  <li>• Multi-epoch Walrus storage</li>
                  <li>• Priority relayer SLA</li>
                </ul>
              </div>
            </div>
          </div>

          <div id="quota-resets" className="scroll-mt-28 space-y-3">
            <h3 className="text-xl font-display text-txt">Daily Quota Mechanics</h3>
            <p className="text-sm text-mut leading-relaxed">
              Daily save quotas count calls to <code className="font-mono text-rose">engram_remember</code> or <code className="font-mono text-rose">/api/remember</code>. Daily counters reset automatically at <strong>00:00 UTC</strong> every night. Recalls (<code className="font-mono">engram_recall</code>) are unlimited for all active users.
            </p>
          </div>
        </div>
      ),
    },
  ], [copiedSnippet])

  // Filtered articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles
    const q = searchQuery.toLowerCase()
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.toc.some((t) => t.label.toLowerCase().includes(q))
    )
  }, [articles, searchQuery])

  const activeArticle = useMemo(() => {
    return articles.find((a) => a.id === activeArticleId) || articles[0]
  }, [articles, activeArticleId])

  const activeIndex = articles.findIndex((a) => a.id === activeArticle.id)
  const prevArticle = activeIndex > 0 ? articles[activeIndex - 1] : null
  const nextArticle = activeIndex < articles.length - 1 ? articles[activeIndex + 1] : null

  // Grouped for sidebar (filters actively with search)
  const categories = useMemo(() => {
    const map = new Map<string, DocArticle[]>()
    filteredArticles.forEach((a) => {
      const list = map.get(a.category) || []
      list.push(a)
      map.set(a.category, list)
    })
    return Array.from(map.entries())
  }, [filteredArticles])

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col justify-between">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-violet/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 h-[500px] w-[500px] rounded-full bg-rose/10 blur-[140px]" />
      </div>

      <Nav />

      {/* Top Breadcrumb & Status Bar */}
      <div className="border-b border-line/80 bg-surface/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 text-xs">
          <div className="flex items-center gap-2 text-faint">
            <Link to="/" className="hover:text-txt transition">Engram</Link>
            <ChevronRight size={13} />
            <span className="text-mut">Docs</span>
            <ChevronRight size={13} />
            <span className="text-txt font-medium">{activeArticle.category}</span>
            <ChevronRight size={13} />
            <span className="text-rose font-medium">{activeArticle.title}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Walrus Mainnet
            </span>
            <span className="text-faint">·</span>
            <span className="text-mut">Sui Network</span>
            <span className="text-faint">·</span>
            <span className="text-rose font-semibold">{activeArticle.badge || 'v0.1.0'}</span>
          </div>
        </div>
      </div>

      {/* Standard 3-Column Web3 Documentation Layout */}
      <div className="mx-auto w-full max-w-7xl px-5 py-8 flex-1">
        {/* Mobile Topic Selector */}
        <div className="lg:hidden mb-6 space-y-2">
          <label className="block text-xs font-mono uppercase text-mut">Documentation Topic</label>
          <select
            value={activeArticleId}
            onChange={(e) => {
              setActiveArticleId(e.target.value)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="w-full rounded-2xl border border-line bg-surface/80 p-3 text-xs text-txt focus:border-rose/50"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.category} — {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr_220px] items-start">
          {/* ── LEFT COLUMN: STATIONARY SIDEBAR NAVIGATION ── */}
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pr-2 pb-10 space-y-5">
            {/* Search Input pinned at top of stationary sidebar */}
            <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur-md pb-2 pt-1">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation…"
                  className="w-full rounded-2xl border border-line bg-surface/70 pl-9 pr-3 py-2 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none transition shadow-sm"
                />
              </div>
            </div>

            {/* Nav Tree (Stationary, with no layout shift on selection) */}
            <div className="space-y-5">
              {categories.map(([cat, items]) => (
                <div key={cat}>
                  <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint mb-2 px-2">
                    {cat}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setActiveArticleId(item.id)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={`w-full text-left py-2 px-3 rounded-xl transition flex items-center justify-between border ${
                            activeArticleId === item.id
                              ? 'bg-rose/15 text-rose font-medium border-rose/30 shadow-sm'
                              : 'border-transparent text-mut hover:text-txt hover:bg-surface/40 hover:border-line/40'
                          }`}
                        >
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-2 rounded bg-surface/80 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-faint shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="border-t border-line/60 pt-4 px-2 space-y-2">
                <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Quick Resources</p>
                <div className="space-y-1.5 text-xs text-mut">
                  <a
                    href="https://walruscan.com/mainnet"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-rose transition"
                  >
                    <span>Walruscan Explorer</span> <ExternalLink size={11} className="text-faint" />
                  </a>
                  <a
                    href="https://github.com/Ipramking/engram"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-rose transition"
                  >
                    <span>GitHub Repository</span> <ExternalLink size={11} className="text-faint" />
                  </a>
                  <Link to="/dashboard" className="flex items-center gap-1.5 text-rose hover:underline">
                    <span>Manage API Keys →</span>
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          {/* ── CENTER COLUMN: MAIN CONTENT ── */}
          <main className="min-w-0 max-w-3xl">
            {/* Header info */}
            <div className="mb-8 border-b border-line/80 pb-6">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">
                {activeArticle.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-display text-txt mt-1 mb-3">
                {activeArticle.title}
              </h1>
              <p className="text-sm sm:text-base text-mut leading-relaxed">
                {activeArticle.description}
              </p>
            </div>

            {/* Main content body */}
            <div className="space-y-8">
              {activeArticle.content}
            </div>

            {/* Next / Previous Page Navigation Footer */}
            <div className="mt-14 border-t border-line/80 pt-8 flex items-center justify-between gap-4">
              {prevArticle ? (
                <button
                  onClick={() => {
                    setActiveArticleId(prevArticle.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface/30 px-4 py-3 text-xs text-mut hover:text-txt hover:border-rose/40 transition text-left"
                >
                  <ArrowLeft size={14} className="text-rose" />
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-faint">Previous</span>
                    <span className="font-medium text-txt">{prevArticle.title}</span>
                  </div>
                </button>
              ) : <div />}

              {nextArticle && (
                <button
                  onClick={() => {
                    setActiveArticleId(nextArticle.id)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="flex items-center gap-2 rounded-2xl border border-line bg-surface/30 px-4 py-3 text-xs text-mut hover:text-txt hover:border-rose/40 transition text-right ml-auto"
                >
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-faint">Next</span>
                    <span className="font-medium text-txt">{nextArticle.title}</span>
                  </div>
                  <ArrowRight size={14} className="text-rose" />
                </button>
              )}
            </div>
          </main>

          {/* ── RIGHT COLUMN: STATIONARY "ON THIS PAGE" TOC & ECOSYSTEM ── */}
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto pl-2 pb-10 space-y-6">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-wider text-faint mb-3">
                On this page
              </p>
              <ul className="space-y-2 text-xs">
                {activeArticle.toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="text-mut hover:text-rose transition block leading-relaxed"
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Web3 Community Callout */}
            <div className="rounded-2xl border border-line glass p-4 space-y-2.5">
              <p className="font-mono text-[10.5px] uppercase tracking-wider text-rose font-bold">
                Ecosystem
              </p>
              <p className="text-[11.5px] text-mut leading-relaxed">
                Engram is built on Sui and Walrus for the autonomous agent ecosystem.
              </p>
              <a
                href="https://walruscan.com/mainnet"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-txt hover:text-rose transition"
              >
                <span>Walrus Explorer</span> <ExternalLink size={11} />
              </a>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  )
}
