import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Key, Users, BarChart3, Search, Plus, Trash2, Copy, Check, ExternalLink,
  Shield, Smartphone, Laptop, Terminal, Sparkles, AlertCircle, RefreshCw, LogOut,
  ChevronRight, Lock, CheckCircle2, UserPlus, Info, Layers
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'
import { safeJson } from '../lib/api'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scope: 'personal' | 'team'
  room: string
  team_id?: string
  created_at: string
  connectorUrl: string
}

interface Team {
  id: string
  name: string
  created_at: string
  plan_tier?: string
}

interface TeamMember {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
}

interface UsageData {
  plan: string
  personal: {
    saves: number
    dailyLimit: number
    recalls: number
    maxMemories: number
  }
  teams: Array<{
    teamId: string
    teamName: string
    plan: string
    saves: number
    dailyLimit: number
    recalls: number
    maxMembers: number
  }>
}

export default function DashboardPage() {
  const { user, token, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'connect' | 'keys' | 'teams' | 'usage' | 'memories'>('connect')
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  
  // States for new key creation
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScope, setNewKeyScope] = useState<'personal' | 'team'>('personal')
  const [newKeyTeamId, setNewKeyTeamId] = useState('')
  const [newKeyRoom, setNewKeyRoom] = useState('my-space')
  const [createdKeyRaw, setCreatedKeyRaw] = useState<string | null>(null)
  const [createdKeyUrl, setCreatedKeyUrl] = useState<string | null>(null)

  // States for new team creation
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  // States for invite member
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Memory Explorer state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'personal' | 'team'>('personal')
  const [memories, setMemories] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Copy state helper
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const copyToClipboard = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [authLoading, user, navigate])

  // Load dashboard data
  const fetchData = async () => {
    if (!token) return
    try {
      // 1. Fetch Keys
      const keysRes = await fetch('/api/keys', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (keysRes.ok) {
        const kData = await safeJson(keysRes)
        setKeys(kData?.keys || [])
      }

      // 2. Fetch Teams
      const teamsRes = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (teamsRes.ok) {
        const tData = await safeJson(teamsRes)
        setTeams(tData?.teams || [])
        if (tData?.teams?.length && !selectedTeam) {
          setSelectedTeam(tData.teams[0])
        }
      }

      // 3. Fetch Usage
      const usageRes = await fetch('/api/usage', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (usageRes.ok) {
        const uData = await safeJson(usageRes)
        setUsage(uData)
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    }
  }

  useEffect(() => {
    if (token) {
      fetchData()
    }
  }, [token])

  // Load team members when selectedTeam changes
  useEffect(() => {
    if (selectedTeam && token) {
      fetch(`/api/teams/members?teamId=${selectedTeam.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => safeJson(r))
        .then((d) => {
          if (d?.ok) setTeamMembers(d.members || [])
        })
        .catch(console.error)
    }
  }, [selectedTeam, token])

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim() || !token) return
    try {
      const res = await fetch('/api/keys/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scope: newKeyScope,
          teamId: newKeyScope === 'team' ? newKeyTeamId : undefined,
          room: newKeyRoom.trim() || 'my-space',
        }),
      })
      const data = await safeJson(res)
      if (res.ok && data?.key) {
        setCreatedKeyRaw(data.key.rawKey)
        setCreatedKeyUrl(data.key.connectorUrl)
        fetchData()
      } else {
        alert(data?.error || 'Failed to create key')
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating key')
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Connected agents will stop syncing.') || !token) {
      return
    }
    try {
      const res = await fetch('/api/keys/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyId }),
      })
      if (res.ok) {
        setKeys(keys.filter((k) => k.id !== keyId))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim() || !token) return
    try {
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTeamName.trim() }),
      })
      const data = await safeJson(res)
      if (res.ok && data?.team) {
        setShowTeamModal(false)
        setNewTeamName('')
        fetchData()
        setSelectedTeam(data.team)
      } else {
        alert(data.error || 'Failed to create team')
      }
    } catch (err: any) {
      alert(err?.message || 'Error creating team')
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeam || !inviteEmail.trim() || !token) return
    setInviteError(null)
    setInviteSuccess(null)
    try {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })
      const data = await safeJson(res)
      if (res.ok) {
        setInviteSuccess(`Invited ${inviteEmail} successfully!`)
        setInviteEmail('')
        // Refresh members
        const memRes = await fetch(`/api/teams/members?teamId=${selectedTeam.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const memData = await safeJson(memRes)
        if (memData.ok) setTeamMembers(memData.members || [])
      } else {
        setInviteError(data.error || 'Failed to invite member.')
      }
    } catch (err: any) {
      setInviteError(err?.message || 'Error inviting member.')
    }
  }

  const handleSearchMemories = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearching(true)
    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          scope: searchScope,
          teamCode: selectedTeam ? selectedTeam.id : 'default',
          topK: 8,
        }),
      })
      const data = await safeJson(res)
      setMemories(data.results || [])
    } catch (err) {
      console.error('Failed to search memories:', err)
    } finally {
      setSearching(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-txt">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose border-t-transparent mx-auto mb-4" />
          <p className="text-sm font-mono text-faint">Loading Engram dashboard…</p>
        </div>
      </div>
    )
  }

  // Choose primary active key for quick setup snippets
  const personalKey = keys.find((k) => k.scope === 'personal')
  const defaultConnectorUrl = personalKey
    ? `https://engram-mcp.onrender.com/mcp?token=${personalKey.key_prefix}...&room=${personalKey.room}`
    : 'https://engram-mcp.onrender.com/mcp?token=<YOUR_API_KEY>&room=my-space'

  return (
    <div className="min-h-screen bg-bg text-txt flex flex-col justify-between">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 right-1/4 h-[600px] w-[600px] rounded-full bg-violet/10 blur-[130px]" />
        <div className="absolute top-1/2 -left-32 h-[500px] w-[500px] rounded-full bg-rose/10 blur-[120px]" />
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-line/80 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-6">
            <Wordmark />
            <span className="hidden sm:inline-block rounded-full border border-line bg-surface/60 px-2.5 py-0.5 text-[11px] font-mono text-faint">
              Account Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-txt">{user.name || user.email.split('@')[0]}</span>
              <span className="text-[11px] font-mono text-rose">Personal Free Tier</span>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface/40 px-3 py-1.5 text-xs text-mut hover:text-txt hover:border-rose/40 transition"
              title="Sign out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl px-5 py-8 flex-1">
        {/* User banner & quick metric */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-line glass p-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display text-txt">
              Hello, {user.name || user.email.split('@')[0]}
            </h1>
            <p className="mt-1 text-sm text-mut">
              Manage your personal memory across devices, collaborate with team workspaces, and track usage.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-line bg-bg/60 px-4 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-faint">Today's Saves</p>
              <p className="text-lg font-mono font-bold text-rose">
                {usage?.personal.saves ?? 0} <span className="text-xs text-faint font-normal">/ {usage?.personal.dailyLimit ?? 50}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-bg/60 px-4 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-faint">Active Keys</p>
              <p className="text-lg font-mono font-bold text-violet-soft">{keys.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex gap-2 border-b border-line pb-px overflow-x-auto">
          {[
            { id: 'connect', label: 'Quick Connect & Mobile', icon: Smartphone },
            { id: 'keys', label: 'API Keys', icon: Key },
            { id: 'teams', label: 'Team Spaces', icon: Users },
            { id: 'usage', label: 'Usage & Plans', icon: BarChart3 },
            { id: 'memories', label: 'Memory Explorer', icon: Search },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-rose text-txt'
                  : 'border-transparent text-mut hover:text-txt'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-rose' : 'text-faint'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: QUICK CONNECT & CROSS-PLATFORM SETUP ── */}
        {activeTab === 'connect' && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-line glass p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-display text-txt">Your Personal Memory Endpoint</h2>
                  <p className="text-xs text-mut mt-0.5">Use this endpoint in any MCP-compatible AI client.</p>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Streamable HTTP
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-mut">
                <span className="truncate flex-1">{defaultConnectorUrl}</span>
                <button
                  onClick={() => copyToClipboard(defaultConnectorUrl, 'connectorUrl')}
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-txt hover:border-rose/50 transition"
                >
                  {copiedText === 'connectorUrl' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedText === 'connectorUrl' ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            </div>

            {/* Platform Guides */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Mobile Setup */}
              <div className="rounded-3xl border border-line glass p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-rose/30 bg-rose/10 text-rose">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display text-txt">Mobile Workflows</h3>
                    <p className="text-xs text-mut">Use Engram on iPhone & Android with ChatGPT or Claude</p>
                  </div>
                </div>
                <p className="text-xs text-mut leading-relaxed mb-4">
                  Connect your mobile chatbot to your Engram memory so insights saved on your phone automatically appear on your laptop and CLI.
                </p>
                <div className="space-y-3 text-xs text-mut">
                  <div className="rounded-2xl border border-line bg-bg/50 p-3">
                    <p className="font-semibold text-txt mb-1">Option A: ChatGPT / Claude Custom Instructions</p>
                    <p className="text-faint">
                      Add the Engram Memory prompt to your mobile chatbot instructions along with your personal API key.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-bg/50 p-3">
                    <p className="font-semibold text-txt mb-1">Option B: iOS Shortcut / Android Webhook</p>
                    <p className="text-faint">
                      Save highlighted text or voice notes directly to <code className="text-rose font-mono">POST /api/remember</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cursor & Claude Desktop Setup */}
              <div className="rounded-3xl border border-line glass p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-violet/30 bg-violet/10 text-violet-soft">
                    <Laptop size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display text-txt">Cursor & Claude Desktop</h3>
                    <p className="text-xs text-mut">Paste into your local MCP configuration file</p>
                  </div>
                </div>
                <p className="text-xs text-mut mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
                  claude_desktop_config.json / .cursor/mcp.json
                </p>
                <pre className="overflow-x-auto rounded-2xl border border-line bg-bg/70 p-4 font-mono text-[11.5px] text-txt leading-relaxed">
{`{
  "mcpServers": {
    "engram": {
      "url": "${defaultConnectorUrl}"
    }
  }
}`}
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(
                        {
                          mcpServers: {
                            engram: {
                              url: defaultConnectorUrl,
                            },
                          },
                        },
                        null,
                        2
                      ),
                      'mcpJson'
                    )
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface/50 py-2 text-xs text-mut hover:text-txt transition"
                >
                  {copiedText === 'mcpJson' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedText === 'mcpJson' ? 'Config Copied!' : 'Copy MCP JSON Config'}
                </button>
              </div>

              {/* CLI & Terminal Setup */}
              <div className="rounded-3xl border border-line glass p-6 md:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                    <Terminal size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display text-txt">Terminal, Antigravity & Windsurf (NPM Package)</h3>
                    <p className="text-xs text-mut">Run the official verified npm package directly via stdio</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-txt">
                  <span className="flex-1">npx engram-walrus {personalKey ? `--key=${personalKey.key_prefix}...` : ''}</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `npx engram-walrus ${personalKey ? `--key=${personalKey.key_prefix}...` : ''}`,
                        'npmCmd'
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-txt hover:border-rose/50 transition"
                  >
                    {copiedText === 'npmCmd' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copiedText === 'npmCmd' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: API KEYS ── */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display text-txt">API Credentials & Keys</h2>
                <p className="text-xs text-mut mt-0.5">
                  Generate scoped keys for your personal devices or team workspaces.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedKeyRaw(null)
                  setShowKeyModal(true)
                }}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2 text-xs font-medium text-bg shadow hover:opacity-90 transition"
              >
                <Plus size={14} /> Generate New Key
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line p-10 text-center">
                <Key size={32} className="mx-auto text-faint mb-3" />
                <h3 className="text-base font-display text-txt">No API keys yet</h3>
                <p className="text-xs text-mut mt-1 mb-4">
                  Create an API key to connect your AI chatbots, IDEs, or mobile clients.
                </p>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="rounded-full border border-line px-4 py-2 text-xs text-txt hover:border-rose/50 transition"
                >
                  Create your first key
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-line glass overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-surface/40 text-faint font-mono uppercase tracking-wider text-[10.5px]">
                        <th className="px-5 py-3.5">Name</th>
                        <th className="px-5 py-3.5">Key Prefix</th>
                        <th className="px-5 py-3.5">Scope</th>
                        <th className="px-5 py-3.5">Room</th>
                        <th className="px-5 py-3.5">Created</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {keys.map((k) => (
                        <tr key={k.id} className="hover:bg-surface/20 transition">
                          <td className="px-5 py-4 font-medium text-txt">{k.name}</td>
                          <td className="px-5 py-4 font-mono text-mut">{k.key_prefix}••••••••</td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-mono tracking-wide ${
                                k.scope === 'personal'
                                  ? 'border border-rose/30 bg-rose/10 text-rose'
                                  : 'border border-violet/30 bg-violet/10 text-violet-soft'
                              }`}
                            >
                              {k.scope}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-faint">{k.room}</td>
                          <td className="px-5 py-4 text-faint">
                            {new Date(k.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => copyToClipboard(k.connectorUrl, k.id)}
                                className="rounded-lg border border-line p-1.5 text-mut hover:text-txt hover:border-rose/40 transition"
                                title="Copy MCP URL"
                              >
                                {copiedText === k.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                              </button>
                              <button
                                onClick={() => handleRevokeKey(k.id)}
                                className="rounded-lg border border-line p-1.5 text-rose-400 hover:border-rose-400 transition"
                                title="Revoke Key"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: TEAM SPACES & 3-MEMBER FREE LIMIT ── */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-display text-txt">Shared Team Brains</h2>
                <p className="text-xs text-mut mt-0.5">
                  Teams have an isolated shared memory pool. Teammates read and write shared context.
                </p>
              </div>
              <button
                onClick={() => setShowTeamModal(true)}
                className="flex items-center gap-2 rounded-full border border-line bg-surface/50 px-4 py-2 text-xs font-medium text-txt hover:border-rose/50 transition w-fit"
              >
                <Plus size={14} /> Create Team Space
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line p-10 text-center">
                <Users size={32} className="mx-auto text-faint mb-3" />
                <h3 className="text-base font-display text-txt">No team spaces created</h3>
                <p className="text-xs text-mut mt-1 mb-4">
                  Create a team space to collaborate with up to 3 members on the Free Team Plan.
                </p>
                <button
                  onClick={() => setShowTeamModal(true)}
                  className="rounded-full border border-line px-4 py-2 text-xs text-txt hover:border-rose/50 transition"
                >
                  Create team
                </button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
                {/* Team selection column */}
                <div className="space-y-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-faint mb-2">Your Teams</p>
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeam(t)}
                      className={`w-full text-left p-4 rounded-2xl border transition flex items-center justify-between ${
                        selectedTeam?.id === t.id
                          ? 'border-rose/50 bg-rose/5 text-txt'
                          : 'border-line bg-surface/30 text-mut hover:border-line-2'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm text-txt">{t.name}</p>
                        <p className="text-[11px] font-mono text-faint mt-0.5">ID: {t.id.slice(0, 10)}…</p>
                      </div>
                      <ChevronRight size={16} className={selectedTeam?.id === t.id ? 'text-rose' : 'text-faint'} />
                    </button>
                  ))}
                </div>

                {/* Team Details & Member Roster */}
                {selectedTeam && (
                  <div className="rounded-3xl border border-line glass p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
                      <div>
                        <h3 className="text-lg font-display text-txt">{selectedTeam.name}</h3>
                        <p className="text-xs text-mut">Free Team Plan · Shared Memory Pool</p>
                      </div>
                      {/* Free Plan 3-Member Ceiling Badge */}
                      <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg/80 px-3.5 py-1.5 text-xs font-mono">
                        <span className="text-faint">Members:</span>
                        <span className={teamMembers.length >= 3 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {teamMembers.length} / 3
                        </span>
                        {teamMembers.length >= 3 && (
                          <span className="rounded bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5">
                            Max Reached
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Team Members List */}
                    <div>
                      <p className="text-[11px] font-mono uppercase tracking-wider text-faint mb-3">Team Members</p>
                      <div className="space-y-2">
                        {teamMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-2xl border border-line bg-bg/40 px-4 py-3 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="grid h-7 w-7 place-items-center rounded-xl border border-line bg-surface text-faint">
                                <Users size={14} />
                              </div>
                              <div>
                                <p className="font-medium text-txt">{m.email}</p>
                                <p className="text-[10px] font-mono text-faint">
                                  Joined {new Date(m.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-mono uppercase text-mut">
                              {m.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Invite Teammate Form */}
                    <div className="border-t border-line pt-5">
                      <p className="text-xs font-semibold text-txt mb-2">Invite a teammate</p>
                      <p className="text-xs text-mut mb-4">
                        Free team plans can have up to 3 active members. Upgrade to Pro for larger teams.
                      </p>

                      {inviteError && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                          <AlertCircle size={15} className="shrink-0 text-rose-400" />
                          <span>{inviteError}</span>
                        </div>
                      )}

                      {inviteSuccess && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                          <span>{inviteSuccess}</span>
                        </div>
                      )}

                      <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="teammate@company.com"
                          required
                          disabled={teamMembers.length >= 3}
                          className="flex-1 rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={teamMembers.length >= 3}
                          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 disabled:opacity-40 transition"
                        >
                          <UserPlus size={14} /> Invite
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: USAGE & PLANS ── */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display text-txt">Usage Limits & Quotas</h2>
              <p className="text-xs text-mut mt-0.5">
                Track your daily upload and memory save limits. Daily counters reset at 00:00 UTC.
              </p>
            </div>

            {/* Daily Save Progress Bars */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-line glass p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lock size={16} className="text-rose" />
                    <h3 className="font-medium text-sm text-txt">Personal Daily Saves</h3>
                  </div>
                  <span className="font-mono text-xs text-rose font-bold">
                    {usage?.personal.saves ?? 0} / {usage?.personal.dailyLimit ?? 50}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-gradient-to-r from-rose to-violet transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (((usage?.personal.saves ?? 0) / (usage?.personal.dailyLimit ?? 50)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-[11px] text-faint">
                  50 memory saves per day on Personal Free. Re-calculated daily.
                </p>
              </div>

              <div className="rounded-3xl border border-line glass p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-violet-soft" />
                    <h3 className="font-medium text-sm text-txt">Team Daily Saves</h3>
                  </div>
                  <span className="font-mono text-xs text-violet-soft font-bold">
                    {usage?.teams?.[0]?.saves ?? 0} / {usage?.teams?.[0]?.dailyLimit ?? 150}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-gradient-to-r from-violet to-sky-400 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (((usage?.teams?.[0]?.saves ?? 0) / (usage?.teams?.[0]?.dailyLimit ?? 150)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-[11px] text-faint">
                  150 shared memory saves per day across team members on Free Team Plan.
                </p>
              </div>
            </div>

            {/* Plans Comparison */}
            <div className="mt-8">
              <h3 className="text-lg font-display text-txt mb-4">Engram Plans</h3>
              <div className="grid gap-6 md:grid-cols-3">
                {/* Personal Free */}
                <div className="rounded-3xl border border-rose/40 bg-surface/40 p-6 flex flex-col justify-between relative">
                  <span className="absolute top-4 right-4 rounded-full border border-rose/40 bg-rose/10 px-2.5 py-0.5 text-[10px] font-mono uppercase text-rose">
                    Current
                  </span>
                  <div>
                    <h4 className="font-display text-xl text-txt">Personal Free</h4>
                    <p className="text-2xl font-bold font-mono text-txt mt-2 mb-4">$0 <span className="text-xs text-faint font-normal">/ month</span></p>
                    <ul className="space-y-2 text-xs text-mut">
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> 1 User Account</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> 50 Saves / Day</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Cross-device sync (Mobile, Desktop, CLI)</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Seal-encrypted Walrus storage</li>
                    </ul>
                  </div>
                </div>

                {/* Team Free */}
                <div className="rounded-3xl border border-violet/40 bg-surface/40 p-6 flex flex-col justify-between relative">
                  <span className="absolute top-4 right-4 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 text-[10px] font-mono uppercase text-violet-soft">
                    Active
                  </span>
                  <div>
                    <h4 className="font-display text-xl text-txt">Team Free</h4>
                    <p className="text-2xl font-bold font-mono text-txt mt-2 mb-4">$0 <span className="text-xs text-faint font-normal">/ month</span></p>
                    <ul className="space-y-2 text-xs text-mut">
                      <li className="flex items-center gap-2 font-semibold text-txt"><Check size={14} className="text-emerald-400" /> Up to 3 Team Members</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> 150 Saves / Day (Shared)</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> 1 Shared Team Memory Space</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Role-based access (Owner, Member)</li>
                    </ul>
                  </div>
                </div>

                {/* Pro Tier (Upgrade Preview) */}
                <div className="rounded-3xl border border-line glass p-6 flex flex-col justify-between">
                  <div>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-mono uppercase text-faint">
                      Upgrade
                    </span>
                    <h4 className="font-display text-xl text-txt mt-2">Team Pro & Enterprise</h4>
                    <p className="text-2xl font-bold font-mono text-txt mt-2 mb-4">$29 <span className="text-xs text-faint font-normal">/ seat / mo</span></p>
                    <ul className="space-y-2 text-xs text-mut">
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Unlimited Team Members</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> 2,000+ Saves / Day</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Permanent Multi-Epoch Walrus Blobs</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Audit Log & Export</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => alert('Paid Plans & Stripe billing integration are launching soon in Phase 5!')}
                    className="mt-6 w-full rounded-full border border-line py-2 text-xs text-mut hover:text-txt hover:border-rose/50 transition"
                  >
                    Join Pro Waitlist
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: MEMORY EXPLORER ── */}
        {activeTab === 'memories' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-display text-txt">Memory Explorer</h2>
              <p className="text-xs text-mut mt-0.5">
                Inspect memories stored on Walrus. Search by semantic query to see what your agents recall.
              </p>
            </div>

            {/* Search form */}
            <form onSubmit={handleSearchMemories} className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearchScope('personal')}
                  className={`rounded-2xl border px-3.5 py-2.5 text-xs font-mono transition ${
                    searchScope === 'personal'
                      ? 'border-rose bg-rose/10 text-rose'
                      : 'border-line text-mut'
                  }`}
                >
                  Personal
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('team')}
                  className={`rounded-2xl border px-3.5 py-2.5 text-xs font-mono transition ${
                    searchScope === 'team'
                      ? 'border-violet bg-violet/10 text-violet-soft'
                      : 'border-line text-mut'
                  }`}
                >
                  Team
                </button>
              </div>

              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. database setup, deployment rules, styling decisions…"
                  className="w-full rounded-2xl border border-line bg-bg/80 pl-10 pr-4 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 transition"
              >
                {searching ? 'Querying Walrus…' : 'Search Memories'}
              </button>
            </form>

            {/* Memories Results */}
            {memories.length === 0 ? (
              <div className="rounded-3xl border border-line glass p-8 text-center text-xs text-mut">
                <Layers size={28} className="mx-auto text-faint mb-2.5" />
                <p>Run a semantic search above to explore memories captured by your connected agents.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {memories.map((m, idx) => (
                  <div key={idx} className="rounded-3xl border border-line glass p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-rose/30 bg-rose/10 px-2 py-0.5 text-[10px] font-mono uppercase text-rose">
                        {m.type || 'decision'}
                      </span>
                      {m.blobId && (
                        <a
                          href={`https://walruscan.com/mainnet/blob/${m.blobId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-mono text-[10.5px] text-faint hover:text-rose transition"
                        >
                          {m.blobId.slice(0, 8)}… <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-txt leading-relaxed">{m.text}</p>
                    <div className="border-t border-line/60 pt-2 flex items-center justify-between text-[11px] text-faint">
                      <span>Scope: {searchScope}</span>
                      <span>Verified on Walrus</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL: CREATE NEW API KEY ── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line glass p-6 shadow-2xl">
            <h3 className="text-xl font-display text-txt mb-1">Generate API Key</h3>
            <p className="text-xs text-mut mb-4">
              Create an authentication key to connect an AI client to your memory.
            </p>

            {createdKeyRaw ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                  <p className="font-semibold mb-1">Key Created! Copy it now.</p>
                  <p className="text-[11px] text-emerald-300/80">
                    For security reasons, this key will not be displayed again.
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-mono text-faint uppercase mb-1">Your Secret API Key</p>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-2.5 font-mono text-xs text-txt">
                    <span className="truncate flex-1">{createdKeyRaw}</span>
                    <button
                      onClick={() => copyToClipboard(createdKeyRaw, 'rawKey')}
                      className="rounded-lg border border-line p-1.5 text-mut hover:text-txt"
                    >
                      {copiedText === 'rawKey' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {createdKeyUrl && (
                  <div>
                    <p className="text-[11px] font-mono text-faint uppercase mb-1">Connector URL</p>
                    <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-2.5 font-mono text-xs text-txt">
                      <span className="truncate flex-1">{createdKeyUrl}</span>
                      <button
                        onClick={() => copyToClipboard(createdKeyUrl, 'rawUrl')}
                        className="rounded-lg border border-line p-1.5 text-mut hover:text-txt"
                      >
                        {copiedText === 'rawUrl' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowKeyModal(false)
                    setCreatedKeyRaw(null)
                  }}
                  className="w-full rounded-full bg-gradient-to-r from-rose to-violet py-2.5 text-xs font-medium text-bg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-mut mb-1">Key Name / Label</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Work Laptop Cursor, Claude Mobile, Antigravity CLI"
                    required
                    className="w-full rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-mut mb-1">Scope</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewKeyScope('personal')}
                      className={`rounded-2xl border p-2.5 text-xs text-center transition ${
                        newKeyScope === 'personal'
                          ? 'border-rose bg-rose/10 text-rose font-medium'
                          : 'border-line text-mut'
                      }`}
                    >
                      Personal Memory
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewKeyScope('team')}
                      className={`rounded-2xl border p-2.5 text-xs text-center transition ${
                        newKeyScope === 'team'
                          ? 'border-violet bg-violet/10 text-violet-soft font-medium'
                          : 'border-line text-mut'
                      }`}
                    >
                      Team Shared
                    </button>
                  </div>
                </div>

                {newKeyScope === 'team' && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-mut mb-1">Select Team</label>
                    <select
                      value={newKeyTeamId}
                      onChange={(e) => setNewKeyTeamId(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt focus:border-violet/50 focus:outline-none"
                    >
                      <option value="">Select a team…</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono uppercase text-mut mb-1">Room Identifier</label>
                  <input
                    type="text"
                    value={newKeyRoom}
                    onChange={(e) => setNewKeyRoom(e.target.value)}
                    placeholder="my-space"
                    className="w-full rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt focus:border-rose/50 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="flex-1 rounded-full border border-line py-2.5 text-xs text-mut hover:text-txt"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-full bg-gradient-to-r from-rose to-violet py-2.5 text-xs font-medium text-bg shadow hover:opacity-95"
                  >
                    Generate Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE TEAM ── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line glass p-6 shadow-2xl">
            <h3 className="text-xl font-display text-txt mb-1">Create Team Space</h3>
            <p className="text-xs text-mut mb-4">
              Create a shared memory space for your engineering team. Up to 3 members on the Free Team Plan.
            </p>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-mut mb-1">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. SuiHub Core, Frontend Guild, Autonomous Ops"
                  required
                  className="w-full rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="flex-1 rounded-full border border-line py-2.5 text-xs text-mut hover:text-txt"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-gradient-to-r from-rose to-violet py-2.5 text-xs font-medium text-bg shadow hover:opacity-95"
                >
                  Create Team Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dashboard Footer */}
      <footer className="hairline-t py-6 text-center text-xs text-faint font-mono">
        Engram Decentralized Memory · Walrus Mainnet · Powered by Sui
      </footer>
    </div>
  )
}
