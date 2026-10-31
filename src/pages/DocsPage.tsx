import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, BookOpen, Terminal, Laptop, Smartphone, Users, Lock, Key, Shield,
  Check, Copy, ExternalLink, ArrowRight, Sparkles, Download, Layers, AlertCircle,
  FileText, Code2, Server, HelpCircle, ChevronRight
} from 'lucide-react'
import { Wordmark, Nav, Footer } from '../components/Chrome'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  { id: 'overview', title: 'Overview & Architecture', group: 'Getting Started' },
  { id: 'quickstart', title: 'Quickstart Guide', group: 'Getting Started' },
  { id: 'taxonomy', title: 'Memory Taxonomy (6 Types)', group: 'Core Concepts' },
  { id: 'scopes', title: 'Personal vs. Team Memory', group: 'Core Concepts' },
  { id: 'walrus', title: 'Walrus & Seal Encryption', group: 'Core Concepts' },
  { id: 'desktop', title: 'Claude Desktop & Cursor', group: 'Platform Guides' },
  { id: 'mobile', title: 'Mobile Workflows (iOS & Android)', group: 'Platform Guides' },
  { id: 'cli', title: 'CLI & NPM Package (engram-walrus)', group: 'Platform Guides' },
  { id: 'mcp-reference', title: 'MCP Protocol & Tools', group: 'API Reference' },
  { id: 'rest-api', title: 'REST Endpoints', group: 'API Reference' },
  { id: 'plans', title: 'Plans, Quotas & Limits', group: 'Billing & Limits' },
]

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const { user } = useAuth()

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(id)
    setTimeout(() => setCopiedSnippet(null), 2000)
  }

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col justify-between">
      {/* Background ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 right-1/4 h-[600px] w-[600px] rounded-full bg-violet/10 blur-[140px]" />
        <div className="absolute top-1/2 -left-40 h-[500px] w-[500px] rounded-full bg-rose/10 blur-[140px]" />
      </div>

      <Nav />

      {/* Hero Header */}
      <div className="border-b border-line/80 bg-surface/20">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs text-mut mb-4">
            <BookOpen size={13} className="text-rose" /> Official Documentation
          </div>
          <h1 className="text-3xl sm:text-5xl font-display text-txt">
            Engram Documentation
          </h1>
          <p className="mt-3 max-w-2xl text-base sm:text-lg text-mut leading-relaxed">
            The complete guide to cross-platform persistent memory for AI agents. Learn how to connect your tools, manage team brains, and leverage verifiable Walrus storage.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => downloadText('engram-rules.txt', ENGRAM_PROMPT)}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/50 px-4 py-2 text-xs font-medium text-txt hover:border-rose/50 transition"
            >
              <Download size={14} className="text-rose" /> Download Agent System Prompt
            </button>
            <Link
              to={user ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-xs font-medium text-bg shadow hover:opacity-95 transition"
            >
              {user ? 'Open Dashboard' : 'Create Free Account'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Documentation Grid */}
      <div className="mx-auto w-full max-w-6xl px-5 py-10 flex-1">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* Sticky Sidebar Navigation */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {['Getting Started', 'Core Concepts', 'Platform Guides', 'API Reference', 'Billing & Limits'].map((grp) => (
                <div key={grp}>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-faint mb-2">
                    {grp}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {SECTIONS.filter((s) => s.group === grp).map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => {
                            setActiveSection(s.id)
                            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className={`w-full text-left py-1.5 px-2.5 rounded-xl transition ${
                            activeSection === s.id
                              ? 'bg-rose/10 text-rose font-medium'
                              : 'text-mut hover:text-txt hover:bg-surface/30'
                          }`}
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Mobile Section Selector */}
          <div className="lg:hidden mb-6">
            <label className="block text-xs font-mono uppercase text-mut mb-1.5">Jump to topic</label>
            <select
              value={activeSection}
              onChange={(e) => {
                setActiveSection(e.target.value)
                document.getElementById(e.target.value)?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="w-full rounded-2xl border border-line bg-surface/60 p-3 text-xs text-txt focus:border-rose/50"
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.group} — {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Documentation Content Body */}
          <div className="space-y-16 max-w-3xl">
            {/* 1. Overview */}
            <section id="overview" className="scroll-mt-28">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Getting Started</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Overview & Architecture</h2>
              <div className="space-y-4 text-sm leading-relaxed text-mut">
                <p>
                  <strong>Engram</strong> is decentralized, verifiable persistent memory designed for autonomous AI agents, coding assistants, and human-in-the-loop workflows.
                </p>
                <p>
                  Today, every time you open a new session in Cursor, Claude Desktop, or your phone, the agent's context is reset to zero. You find yourself repeatedly explaining your technology stack, architectural choices, conventions, and teammate preferences.
                </p>
                <div className="rounded-3xl border border-line glass p-5 my-4">
                  <h4 className="font-display text-base text-txt mb-2">The Engram Solution</h4>
                  <p className="text-xs text-mut leading-relaxed">
                    Engram extracts durable knowledge from conversations and writes it to <strong>Walrus</strong>, an ultra-fast decentralized blob storage protocol anchored by the Sui blockchain. Memories are encrypted via <strong>Seal</strong>, indexed semantically, and synchronized in real time across mobile phones, laptops, and terminal CLI tools.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Quickstart */}
            <section id="quickstart" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Getting Started</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Quickstart Guide</h2>
              <p className="text-sm text-mut mb-6">
                Get up and running with Engram in 3 straightforward steps:
              </p>

              <div className="space-y-6">
                <div className="rounded-2xl border border-line bg-surface/30 p-5">
                  <div className="flex items-center gap-2 mb-2 font-mono text-xs text-rose">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15">1</span>
                    <span>Create an account & generate an API Key</span>
                  </div>
                  <p className="text-xs text-mut mb-3">
                    Sign up at <Link to="/register" className="text-rose underline">/register</Link> and generate a personal API key (<code className="font-mono text-rose">eng_usr_...</code>) in your dashboard.
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-5">
                  <div className="flex items-center gap-2 mb-2 font-mono text-xs text-rose">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15">2</span>
                    <span>Add the MCP Server to your AI Client</span>
                  </div>
                  <p className="text-xs text-mut mb-3">
                    In your client's configuration file (e.g. Claude Desktop or Cursor), add:
                  </p>
                  <pre className="overflow-x-auto rounded-xl border border-line bg-bg/80 p-3 font-mono text-xs text-txt">
{`{
  "mcpServers": {
    "engram": {
      "url": "https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space"
    }
  }
}`}
                  </pre>
                  <button
                    onClick={() =>
                      copy(
                        `{\n  "mcpServers": {\n    "engram": {\n      "url": "https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space"\n    }\n  }\n}`,
                        'qs-mcp'
                      )
                    }
                    className="mt-2.5 flex items-center gap-1.5 text-xs text-mut hover:text-txt transition"
                  >
                    {copiedSnippet === 'qs-mcp' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedSnippet === 'qs-mcp' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-5">
                  <div className="flex items-center gap-2 mb-2 font-mono text-xs text-rose">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-rose/15">3</span>
                    <span>Instruct your Agent</span>
                  </div>
                  <p className="text-xs text-mut mb-3">
                    Add the Engram rules prompt to your agent's system instructions. The agent will now silently recall memories before responding and store durable facts whenever discovered.
                  </p>
                </div>
              </div>
            </section>

            {/* 3. Taxonomy */}
            <section id="taxonomy" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Core Concepts</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Memory Taxonomy: Signal, Not Noise</h2>
              <p className="text-sm text-mut mb-6">
                To prevent context bloat and hallucination, Engram strictly categorizes all remembered facts into 6 high-signal types:
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { t: 'decision', name: 'Decision', d: 'An architectural or process choice AND its reason.', ex: '“Moved DB to Neon Postgres on Aug 3 because Render free tier expired.”' },
                  { t: 'config', name: 'Config', d: 'A concrete setup value or where something lives.', ex: '“DATABASE_URL is set in Render dashboard env, not .env.”' },
                  { t: 'gotcha', name: 'Gotcha', d: 'A non-obvious pitfall and its tested workaround.', ex: '“supabase CLI has no win32 binary — use standalone .exe.”' },
                  { t: 'person', name: 'Person', d: 'A stable fact about a teammate, lead, or client.', ex: '“Ada leads frontend, prefers Tailwind, in WAT timezone.”' },
                  { t: 'preference', name: 'Preference', d: 'A lasting preference, coding rule, or goal.', ex: '“Every UI must work seamlessly on both mobile and desktop.”' },
                  { t: 'plan', name: 'Plan', d: 'A multi-step spec, task list, or notes kept on request.', ex: '“Our launch plan: 1) Ship MCP, 2) Run test suite, 3) Open signups.”' },
                ].map((item) => (
                  <div key={item.t} className="rounded-2xl border border-line bg-surface/30 p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-display text-base text-txt">{item.name}</h4>
                      <span className="font-mono text-[10px] uppercase text-rose rounded bg-rose/10 px-2 py-0.5">{item.t}</span>
                    </div>
                    <p className="text-xs text-mut mb-2">{item.d}</p>
                    <p className="font-mono text-[11px] text-faint bg-bg/40 p-2 rounded-xl">{item.ex}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Scopes */}
            <section id="scopes" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Core Concepts</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Personal vs. Team Memory</h2>
              <p className="text-sm text-mut mb-6">
                Engram enforces strict isolation boundaries between personal and team knowledge:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-rose/30 bg-rose/[0.04] p-5">
                  <div className="flex items-center gap-2 text-rose mb-3">
                    <Lock size={18} />
                    <h3 className="font-display text-lg text-txt">Personal Memory</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-mut">
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-rose shrink-0 mt-0.5" />
                      <span>Authenticated with personal API keys (<code className="font-mono text-rose">eng_usr_...</code>)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-rose shrink-0 mt-0.5" />
                      <span>Namespaced strictly to <code className="font-mono">usr_&lt;id&gt;</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-rose shrink-0 mt-0.5" />
                      <span>Never visible to teammates or shared rooms</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-rose shrink-0 mt-0.5" />
                      <span>Syncs across your personal phone, laptop, and CLI</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-3xl border border-violet/30 bg-violet/[0.04] p-5">
                  <div className="flex items-center gap-2 text-violet-soft mb-3">
                    <Users size={18} />
                    <h3 className="font-display text-lg text-txt">Team Memory</h3>
                  </div>
                  <ul className="space-y-2 text-xs text-mut">
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-violet-soft shrink-0 mt-0.5" />
                      <span>Authenticated with team API keys (<code className="font-mono text-violet-soft">eng_team_...</code>)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-violet-soft shrink-0 mt-0.5" />
                      <span>Namespaced strictly to <code className="font-mono">team_&lt;id&gt;</code></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-violet-soft shrink-0 mt-0.5" />
                      <span>Accessible to all authorized team members</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="text-violet-soft shrink-0 mt-0.5" />
                      <span>Strict max 3 members on Free Team Plan</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 5. Walrus & Seal */}
            <section id="walrus" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Core Concepts</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Walrus & Seal Encryption</h2>
              <div className="space-y-4 text-sm leading-relaxed text-mut">
                <p>
                  Every memory in Engram is committed to <strong>Walrus</strong>, Mysten Labs' decentralized storage protocol built on Sui.
                </p>
                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <h4 className="font-semibold text-txt mb-1 text-xs">On-Chain Verifiability</h4>
                  <p className="text-xs text-mut">
                    Each write generates an immutable <strong>Blob ID</strong> (e.g. <code className="font-mono text-rose">2iD9wFtosZo0...</code>). You can independently inspect the blob on <a href="https://walruscan.com/mainnet" target="_blank" rel="noreferrer" className="text-rose underline">Walruscan</a>.
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <h4 className="font-semibold text-txt mb-1 text-xs">Seal Cryptographic Privacy</h4>
                  <p className="text-xs text-mut">
                    Sensitive contents are encrypted on the client side using Seal threshold cryptography before transmission to storage nodes. Only authenticated requests possessing the corresponding identity keys can decrypt the stored payload.
                  </p>
                </div>
              </div>
            </section>

            {/* 6. Desktop Setup */}
            <section id="desktop" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Platform Guides</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Claude Desktop & Cursor</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-txt mb-2 flex items-center gap-2">
                    <Laptop size={16} className="text-rose" /> Cursor IDE Configuration
                  </h3>
                  <p className="text-xs text-mut mb-2">
                    Open <code className="font-mono">~/.cursor/mcp.json</code> or navigate to <strong>Cursor Settings → Tools & MCP</strong> and add:
                  </p>
                  <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3.5 font-mono text-xs text-txt">
{`{
  "mcpServers": {
    "engram": {
      "url": "https://engram-mcp.onrender.com/mcp?token=YOUR_API_KEY&room=my-space"
    }
  }
}`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-txt mb-2 flex items-center gap-2">
                    <Laptop size={16} className="text-violet-soft" /> Claude Desktop Configuration
                  </h3>
                  <p className="text-xs text-mut mb-2">
                    Open <code className="font-mono">claude_desktop_config.json</code> (Settings → Developer → Edit Config) and paste:
                  </p>
                  <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3.5 font-mono text-xs text-txt">
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
              </div>
            </section>

            {/* 7. Mobile Workflows */}
            <section id="mobile" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Platform Guides</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Mobile Workflows (iOS & Android)</h2>
              <div className="space-y-4 text-sm leading-relaxed text-mut">
                <p>
                  One of Engram's greatest strengths is bringing memory to your phone so ideas captured on the go are waiting in your IDE when you open your laptop.
                </p>

                <div className="rounded-2xl border border-line bg-surface/30 p-4 space-y-2">
                  <h4 className="font-semibold text-txt text-xs flex items-center gap-1.5">
                    <Smartphone size={14} className="text-rose" /> ChatGPT & Claude Mobile Apps (Custom GPTs / Instructions)
                  </h4>
                  <p className="text-xs text-mut">
                    In your ChatGPT custom instructions or Claude system prompt, paste the Engram System Prompt along with your personal API key. When using custom GPTs, add an Action pointing to <code className="font-mono text-rose">https://engram-mcp.onrender.com/api/remember</code>.
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-4 space-y-2">
                  <h4 className="font-semibold text-txt text-xs flex items-center gap-1.5">
                    <Smartphone size={14} className="text-emerald-400" /> iOS Shortcuts / Android Webhook
                  </h4>
                  <p className="text-xs text-mut">
                    Create an iOS Shortcut that takes highlighted text or voice transcriptions and sends a POST request with headers <code className="font-mono">Authorization: Bearer eng_usr_...</code> to instantly pin decisions into your Walrus memory.
                  </p>
                </div>
              </div>
            </section>

            {/* 8. CLI & NPM */}
            <section id="cli" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Platform Guides</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">CLI & NPM Package (engram-walrus)</h2>
              <p className="text-sm text-mut mb-4">
                The official npm package <code className="font-mono text-rose">engram-walrus</code> runs over stdio and can be integrated into any terminal agent:
              </p>

              <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/80 p-3.5 font-mono text-xs text-txt leading-relaxed">
{`# 1. Connect local terminal agent directly to your cloud memory
npx engram-walrus --key=eng_usr_YOUR_KEY

# 2. Or sign in directly to your private Walrus account via browser
npx engram-walrus login

# 3. View CLI help and all flags
npx engram-walrus --help`}
              </pre>
            </section>

            {/* 9. MCP Reference */}
            <section id="mcp-reference" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">API Reference</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">MCP Protocol & Tools</h2>
              <p className="text-sm text-mut mb-4">
                Engram implements the official Model Context Protocol (MCP) tool specification:
              </p>

              <div className="space-y-4">
                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <p className="font-mono text-xs font-bold text-txt">engram_remember(text, type, scope?, team_code?)</p>
                  <p className="text-xs text-mut mt-1">
                    Stores durable knowledge worth keeping. Returns the assigned Walrus blob ID.
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <p className="font-mono text-xs font-bold text-txt">engram_recall(query, scope?, team_code?)</p>
                  <p className="text-xs text-mut mt-1">
                    Executes semantic vector search across stored memories matching the meaning of the query.
                  </p>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <p className="font-mono text-xs font-bold text-txt">engram_tidy(scope?, team_code?)</p>
                  <p className="text-xs text-mut mt-1">
                    Analyzes existing memories in the scope and flags duplicate or overlapping entries.
                  </p>
                </div>
              </div>
            </section>

            {/* 10. REST API */}
            <section id="rest-api" className="scroll-mt-28 border-t border-line/60 pt-12">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">API Reference</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">REST Endpoints</h2>
              <p className="text-sm text-mut mb-4">
                In addition to MCP, Engram exposes clean REST endpoints:
              </p>

              <div className="overflow-x-auto rounded-2xl border border-line glass">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface/40 font-mono uppercase text-[10px] text-faint">
                    <tr>
                      <th className="p-3">Endpoint</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60 text-mut font-mono text-[11px]">
                    <tr>
                      <td className="p-3 text-txt">/api/remember</td>
                      <td className="p-3 text-rose">POST</td>
                      <td className="p-3 font-sans">Persist a memory with type and scope.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-txt">/api/recall</td>
                      <td className="p-3 text-rose">POST</td>
                      <td className="p-3 font-sans">Semantic vector retrieval for a query.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-txt">/api/keys</td>
                      <td className="p-3 text-emerald-400">GET/POST</td>
                      <td className="p-3 font-sans">List and create scoped API keys.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-txt">/api/teams</td>
                      <td className="p-3 text-emerald-400">GET/POST</td>
                      <td className="p-3 font-sans">Manage team workspaces and invite members.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-txt">/api/usage</td>
                      <td className="p-3 text-violet-soft">GET</td>
                      <td className="p-3 font-sans">Fetch daily usage counts and plan ceilings.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 11. Plans & Quotas */}
            <section id="plans" className="scroll-mt-28 border-t border-line/60 pt-12 pb-16">
              <span className="font-mono text-xs text-rose uppercase tracking-wider">Billing & Limits</span>
              <h2 className="text-3xl font-display text-txt mt-1 mb-4">Plans, Quotas & Limits</h2>
              <p className="text-sm text-mut mb-6">
                All daily limits reset automatically at 00:00 UTC:
              </p>

              <div className="grid gap-4 sm:grid-cols-3 text-xs">
                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <h4 className="font-display text-base text-txt mb-1">Personal Free</h4>
                  <p className="text-xl font-bold font-mono text-txt mb-3">$0</p>
                  <ul className="space-y-1.5 text-mut">
                    <li>• 1 user account</li>
                    <li>• <strong>50 saves/day</strong></li>
                    <li>• Cross-platform access</li>
                    <li>• Seal encryption</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-rose/40 bg-surface/50 p-4">
                  <h4 className="font-display text-base text-txt mb-1">Free Team</h4>
                  <p className="text-xl font-bold font-mono text-txt mb-3">$0</p>
                  <ul className="space-y-1.5 text-mut">
                    <li>• <strong>Max 3 members</strong></li>
                    <li>• <strong>150 shared saves/day</strong></li>
                    <li>• 1 shared team space</li>
                    <li>• Role management</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-line bg-surface/30 p-4">
                  <h4 className="font-display text-base text-txt mb-1">Pro / Enterprise</h4>
                  <p className="text-xl font-bold font-mono text-txt mb-3">$29</p>
                  <ul className="space-y-1.5 text-mut">
                    <li>• Unlimited members</li>
                    <li>• 2,000+ saves/day</li>
                    <li>• Multi-epoch blobs</li>
                    <li>• Priority SLA</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
