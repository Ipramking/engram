import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Key, Users, BarChart3, Search, Plus, Trash2, Copy, Check, ExternalLink,
  Shield, Smartphone, Laptop, Terminal, Sparkles, AlertCircle, RefreshCw, LogOut,
  ChevronRight, Lock, CheckCircle2, UserPlus, Info, Layers, Download, FileText,
  AlertTriangle, Clock, Coins, Eye, EyeOff, Share2, MessageSquare, Zap, Code2, Send
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Wordmark } from '../components/Chrome'
import { safeJson } from '../lib/api'
import { ENGRAM_PROMPT, downloadText } from '../lib/promptText'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  liveKey?: string
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
    remaining?: number
    percentUsed?: number
    recalls: number
    maxMemories: number
    resetAt?: number
    secondsUntilReset?: number
  }
  teams: Array<{
    teamId: string
    teamName: string
    plan: string
    saves: number
    dailyLimit: number
    remaining?: number
    percentUsed?: number
    recalls: number
    maxMembers: number
    resetAt?: number
    secondsUntilReset?: number
  }>
}

function formatCountdown(sec?: number) {
  if (!sec || sec <= 0) return 'midnight UTC'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
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
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showSuperseded, setShowSuperseded] = useState<boolean>(true)
  const [memories, setMemories] = useState<any[]>([])
  const [memoryStats, setMemoryStats] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [supersededNotice, setSupersededNotice] = useState<string | null>(null)
  const [memoryViewMode, setMemoryViewMode] = useState<'cards' | 'graph'>('cards')
  const [selectedGraphNode, setSelectedGraphNode] = useState<any | null>(null)

  // Manual Memory Pin state
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false)
  const [newMemoryText, setNewMemoryText] = useState('')
  const [newMemoryType, setNewMemoryType] = useState('decision')
  const [newMemoryScope, setNewMemoryScope] = useState<'personal' | 'team'>('personal')
  const [savingMemory, setSavingMemory] = useState(false)
  const [saveMemoryError, setSaveMemoryError] = useState<string | null>(null)

  // Mobile Workflows Interactive Toolkit State
  const [mobileMode, setMobileMode] = useState<'claude' | 'chatgpt' | 'gemini' | 'shortcuts'>('claude')
  const [showFullMobilePrompt, setShowFullMobilePrompt] = useState(false)
  const [quickMobileText, setQuickMobileText] = useState('')
  const [quickMobileType, setQuickMobileType] = useState('decision')
  const [quickMobileSaving, setQuickMobileSaving] = useState(false)
  const [quickMobileSuccess, setQuickMobileSuccess] = useState<string | null>(null)

  // Copy state helper
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const copyToClipboard = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const shareTextOrUrl = async (title: string, text: string, url?: string, fallbackCopyLabel = 'shared') => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // user cancelled or share failed, fallback to copy
      }
    }
    copyToClipboard(url || text, fallbackCopyLabel)
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

      // 4. Preload active personal memories so Mobile Workflows has live memory pack ready
      const memRes = await fetch('/api/memories?scope=personal&includeSuperseded=true', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (memRes.ok) {
        const mData = await safeJson(memRes)
        if (mData?.ok) {
          setMemories(mData.memories || [])
          if (mData.stats) setMemoryStats(mData.stats)
        }
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
      fetch(`/api/teams?action=members&teamId=${selectedTeam.id}`, {
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
      const res = await fetch('/api/keys?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create',
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
      const res = await fetch('/api/keys?action=revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'revoke', keyId }),
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
      const res = await fetch('/api/teams?action=create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'create', name: newTeamName.trim() }),
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
      const res = await fetch('/api/teams?action=invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'invite',
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
        const memRes = await fetch(`/api/teams?action=members&teamId=${selectedTeam.id}`, {
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

  const loadMemories = async () => {
    if (!token) return
    setSearching(true)
    try {
      const params = new URLSearchParams({
        scope: searchScope,
        teamCode: selectedTeam ? selectedTeam.id : 'default',
        type: typeFilter,
        includeSuperseded: String(showSuperseded),
        search: searchQuery.trim(),
      })
      const res = await fetch(`/api/memories?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await safeJson(res)
      if (data?.ok) {
        setMemories(data.memories || [])
        if (data.stats) setMemoryStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to load memories:', err)
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'memories' && token) {
      loadMemories()
    }
  }, [activeTab, searchScope, typeFilter, showSuperseded, selectedTeam, token])

  const handleSearchMemories = async (e: React.FormEvent) => {
    e.preventDefault()
    loadMemories()
  }

  const handleDeleteMemory = async (id?: string, blobId?: string) => {
    if (!token || (!id && !blobId)) return
    if (!window.confirm('Delete this memory from your active index?')) return
    try {
      const params = new URLSearchParams()
      if (id) params.set('id', id)
      if (blobId) params.set('blobId', blobId)
      const res = await fetch(`/api/memories?${params.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await safeJson(res)
      if (data?.ok) {
        setMemories((prev) => prev.filter((m) => (id ? m.id !== id : m.blobId !== blobId)))
      }
    } catch (err) {
      console.error('Failed to delete memory:', err)
    }
  }

  const exportMemories = (format: 'json' | 'markdown') => {
    if (!memories.length) return
    let content = ''
    let filename = ''
    let mimeType = ''

    if (format === 'json') {
      content = JSON.stringify(memories, null, 2)
      filename = `engram-memories-${searchScope}-${new Date().toISOString().slice(0, 10)}.json`
      mimeType = 'application/json'
    } else {
      const header = `# Engram Agent Memories (${searchScope.toUpperCase()} SCOPE)\nExported on: ${new Date().toISOString()}\nTotal Memories: ${memories.length}\n\n`
      const body = memories
        .map((m, idx) => {
          const status = m.isSuperseded ? ` [SUPERSEDED by ${m.supersededBy || 'newer fact'}]` : ''
          const walrusBlob = m.blobId ? `\n- Walrus Blob: https://walruscan.com/testnet/blob/${m.blobId}` : ''
          const epoch = m.epochMeta ? `\n- Walrus Storage: Epoch ${m.epochMeta.currentEpoch} (${m.epochMeta.daysRemaining}d remaining)` : ''
          return `### ${idx + 1}. [${m.type.toUpperCase()}]${status}\n${m.text}${walrusBlob}${epoch}\n- Created: ${m.createdAt || 'N/A'}\n`
        })
        .join('\n---\n\n')
      content = header + body
      filename = `engram-memories-${searchScope}-${new Date().toISOString().slice(0, 10)}.md`
      mimeType = 'text/markdown'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadClientConfig = (target: 'claude' | 'cursor' | 'antigravity', keyVal?: string) => {
    const firstKey = keys.find((k) => k.scope === 'personal') || keys[0]
    const k = keyVal || firstKey?.liveKey || 'eng_usr_UlZfOXLtgIOsmntlOPnj1bk9zklKUQsH'
    let filename = ''
    let configObj: any = {}

    if (target === 'claude') {
      filename = 'claude_desktop_config.json'
      configObj = {
        mcpServers: {
          engram: {
            command: 'npx',
            args: ['-y', 'engram-walrus', `--key=${k}`],
          },
        },
      }
    } else if (target === 'cursor') {
      filename = 'mcp.json'
      configObj = {
        mcpServers: {
          engram: {
            command: 'npx',
            args: ['-y', 'engram-walrus', `--key=${k}`],
          },
        },
      }
    } else {
      filename = 'mcp_servers.json'
      configObj = {
        engram: {
          command: 'npx',
          args: ['-y', 'engram-walrus', `--key=${k}`],
        },
      }
    }

    const blob = new Blob([JSON.stringify(configObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleQuickMobileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickMobileText.trim() || !token) return
    setQuickMobileSaving(true)
    setQuickMobileSuccess(null)
    try {
      const res = await fetch('/api/remember', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: quickMobileText.trim(),
          type: quickMobileType,
          scope: 'personal',
        }),
      })
      const data = await safeJson(res)
      if (res.ok && data?.ok) {
        setQuickMobileText('')
        setQuickMobileSuccess('Saved to your Walrus vault! Available across all your devices.')
        fetchData()
        setTimeout(() => setQuickMobileSuccess(null), 5000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setQuickMobileSaving(false)
    }
  }

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemoryText.trim() || !token) return
    setSavingMemory(true)
    setSaveMemoryError(null)
    try {
      const res = await fetch('/api/remember', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: newMemoryText.trim(),
          type: newMemoryType,
          scope: newMemoryScope,
          teamCode: selectedTeam ? selectedTeam.id : 'default',
        }),
      })
      const data = await safeJson(res)
      if (res.ok && data?.ok) {
        setShowAddMemoryModal(false)
        setNewMemoryText('')
        if (data.superseded && data.superseded.length > 0) {
          setSupersededNotice(
            `Pinned! Automatically superseded ${data.superseded.length} older conflicting choice: "${data.superseded[0].oldText.slice(0, 45)}...".`
          )
        } else {
          setSupersededNotice(null)
        }
        await loadMemories()
        fetchData()
      } else {
        setSaveMemoryError(data?.error || 'Failed to save memory.')
      }
    } catch (err: any) {
      setSaveMemoryError(err?.message || 'Error saving memory.')
    } finally {
      setSavingMemory(false)
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

  // Choose primary active key for quick setup snippets (always full live token, never truncated "...")
  const personalKey = keys.find((k) => k.scope === 'personal') || keys[0]
  const activeLiveKey = personalKey?.liveKey || 'eng_usr_UlZfOXLtgIOsmntlOPnj1bk9zklKUQsH'
  const activeRoom = personalKey?.room || 'my-space'
  const defaultConnectorUrl =
    personalKey?.connectorUrl && !personalKey.connectorUrl.includes('...')
      ? personalKey.connectorUrl
      : `https://engram-pearl.vercel.app/mcp?token=${activeLiveKey}&room=${activeRoom}`

  const activeMemoriesList = memories.filter((m) => !m.isSuperseded)
  const topMemoriesPreview = activeMemoriesList
    .slice(0, 6)
    .map((m) => `- [${m.type}] ${m.text}`)
    .join('\n')

  const chatgptCustomInstructions = `You have access to my Engram Memory Vault.
1. RECALL: Before answering questions about my projects, setup, preferences, or people, check my memories below (or browse: https://engram-pearl.vercel.app/api/recall?token=${activeLiveKey}&format=text ).
2. SAVE (IMPORTANT): Whenever I state a new decision, config, gotcha, person, preference, or plan (or ask you to remember something), ALWAYS include a clickable link at the end of your reply:
[💾 Tap to Save to Engram](https://engram-pearl.vercel.app/api/remember?token=${activeLiveKey}&type=decision&text=URL_ENCODED_ONE_SENTENCE_FACT)
Replace "decision" with (decision|config|gotcha|person|preference|plan) and URL-encode the text with %20.

KEY MEMORIES:
${topMemoriesPreview || '- User prefers every UI to work on both phone and desktop.'}`.slice(0, 1480)

  const fullMemoryPackForChat = `Here is my complete Engram Memory Vault (${activeMemoriesList.length} active memories) + rules for this chat:

RULES:
1. Use the memories below as ground truth about my projects, setup, people, and preferences.
2. Whenever I state a new decision, config, gotcha, person, preference, or plan worth keeping, include a clickable link at the end of your reply so I can save it in 1 tap:
[💾 Tap to Save to Engram](https://engram-pearl.vercel.app/api/remember?token=${activeLiveKey}&type=decision&text=URL_ENCODED_ONE_SENTENCE_FACT)

MY ACTIVE MEMORIES:
${activeMemoriesList.map((m, i) => `${i + 1}. [${(m.type || 'decision').toUpperCase()}] ${m.text}`).join('\n')}`

  const geminiGemInstructions = `You are my personalized AI assistant connected to my Engram decentralized memory vault on Walrus.

HOW TO OPERATE:
1. RECALL (GROUND TRUTH): Before answering questions about my projects, stack, decisions, preferences, or team members, verify against my active memories below or check my live plain-text feed:
https://engram-pearl.vercel.app/api/recall?token=${activeLiveKey}&format=text

2. SAVING MEMORIES (IMPORTANT): Whenever I state an architectural choice, setup value, gotcha fix, person/teammate note, preference, or plan (or ask you to remember/keep something), acknowledge it and ALWAYS append a clickable Markdown link at the very end of your response:
[💾 Tap to Save to Engram](https://engram-pearl.vercel.app/api/remember?token=${activeLiveKey}&type=decision&text=URL_ENCODED_ONE_SENTENCE_FACT)
Replace "decision" with (decision|config|gotcha|person|preference|plan) and URL-encode the one-sentence fact with %20.

MY ACTIVE MEMORIES:
${activeMemoriesList.map((m, i) => `${i + 1}. [${(m.type || 'decision').toUpperCase()}] ${m.text}`).join('\n') || '- User prefers every UI to work on both phone and desktop.'}`

  const geminiMcpSnippet = `# Add to ~/.gemini/settings.json or mcp_servers.json
mcp_servers:
  engram:
    url: "${defaultConnectorUrl}"`

  const chatgptOpenApiSchema = JSON.stringify(
    {
      openapi: '3.1.0',
      info: {
        title: 'Engram Walrus Memory API',
        description: 'Read and write persistent developer memories on Walrus decentralized storage.',
        version: '1.0.0',
      },
      servers: [{ url: 'https://engram-pearl.vercel.app' }],
      paths: {
        '/api/recall': {
          get: {
            operationId: 'engramRecall',
            summary: 'Recall relevant memories before answering questions about projects, setup, or people.',
            parameters: [
              {
                name: 'query',
                in: 'query',
                required: false,
                schema: { type: 'string' },
                description: 'Keywords or question to match against stored memories.',
              },
              {
                name: 'scope',
                in: 'query',
                required: false,
                schema: { type: 'string', enum: ['personal', 'team'], default: 'personal' },
              },
            ],
            responses: { '200': { description: 'Matched memories returned' } },
          },
        },
        '/api/remember': {
          post: {
            operationId: 'engramRemember',
            summary: 'Save a durable memory (decision, config, gotcha, person, preference, plan).',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                      text: {
                        type: 'string',
                        description: 'Self-contained one-sentence fact with date and reason.',
                      },
                      type: {
                        type: 'string',
                        enum: ['decision', 'config', 'gotcha', 'person', 'preference', 'plan'],
                        default: 'decision',
                      },
                      scope: {
                        type: 'string',
                        enum: ['personal', 'team'],
                        default: 'personal',
                      },
                    },
                  },
                },
              },
            },
            responses: { '200': { description: 'Memory anchored on Walrus' } },
          },
        },
      },
    },
    null,
    2
  )

  const shortcutJsonTemplate = JSON.stringify(
    {
      text: 'Shortcut Input',
      type: 'decision',
      scope: 'personal',
    },
    null,
    2
  )

  const shortcutCurlSnippet = `curl -X POST "https://engram-pearl.vercel.app/api/remember" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${activeLiveKey}" \\
  -d '{"text":"My mobile voice note or decision","type":"decision","scope":"personal"}'`

  const handleTidyMemories = async () => {
    const active = memories.filter((m) => !m.isSuperseded)
    const toRemoveIds: string[] = []
    const seen = new Set<string>()
    for (const m of active) {
      const norm = String(m.text || '').trim().toLowerCase()
      if (seen.has(norm) && m.id) {
        toRemoveIds.push(m.id)
      } else {
        seen.add(norm)
      }
    }
    if (toRemoveIds.length === 0) {
      setSupersededNotice(`Tidy check complete: All ${active.length} active memories are unique with 0 exact duplicates.`)
      return
    }
    for (const id of toRemoveIds) {
      await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    setSupersededNotice(`Consolidated and removed ${toRemoveIds.length} duplicate memory record(s).`)
    await loadMemories()
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-bg text-txt flex flex-col justify-between">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 right-1/4 h-[600px] w-[600px] rounded-full bg-violet/10 blur-[130px]" />
        <div className="absolute top-1/2 -left-32 h-[500px] w-[500px] rounded-full bg-rose/10 blur-[120px]" />
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 border-b border-line/80 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3.5 sm:px-5 py-3">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Wordmark />
            <span className="hidden sm:inline-block rounded-full border border-line bg-surface/60 px-2.5 py-0.5 text-[11px] font-mono text-faint">
              Account Dashboard
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="flex flex-col text-right">
              <span className="text-[11px] sm:text-xs font-medium text-txt truncate max-w-[120px] sm:max-w-none">
                {user.name || user.email.split('@')[0]}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-rose">Personal Free Tier</span>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface/40 px-2.5 sm:px-3 py-1.5 text-xs text-mut hover:text-txt hover:border-rose/40 transition"
              title="Sign out"
            >
              <LogOut size={13} />
              <span className="hidden xs:inline sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-3.5 sm:px-5 py-5 sm:py-8 flex-1">
        {/* User banner & quick metric */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-line glass p-4 sm:p-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-display text-txt truncate">
              Hello, {user.name || user.email.split('@')[0]}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-mut leading-relaxed">
              Manage your personal memory across devices, collaborate with team workspaces, and track usage.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
            <div className="rounded-2xl border border-line bg-bg/60 px-3.5 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-faint">Today's Saves</p>
              <p className="text-base sm:text-lg font-mono font-bold text-rose">
                {usage?.personal.saves ?? 0} <span className="text-xs text-faint font-normal">/ {usage?.personal.dailyLimit ?? 50}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-bg/60 px-3.5 py-2.5 text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-faint">Active Keys</p>
              <p className="text-base sm:text-lg font-mono font-bold text-violet-soft">{keys.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation — 2-col pill grid on mobile (zero overflow), horizontal bar on sm+ */}
        <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-2 sm:flex sm:gap-2 sm:border-b sm:border-line sm:pb-px">
          {[
            { id: 'connect', label: 'Quick Connect & Mobile', shortLabel: 'Quick Connect', icon: Smartphone },
            { id: 'keys', label: 'API Keys', shortLabel: 'API Keys', icon: Key },
            { id: 'teams', label: 'Team Spaces', shortLabel: 'Team Spaces', icon: Users },
            { id: 'usage', label: 'Usage & Plans', shortLabel: 'Usage & Plans', icon: BarChart3 },
            { id: 'memories', label: 'Memory Explorer', shortLabel: 'Memory Explorer', icon: Search, fullMobile: true },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${tab.fullMobile ? 'col-span-2 sm:col-span-1' : ''} flex items-center justify-center sm:justify-start gap-2 rounded-2xl sm:rounded-none border sm:border-0 sm:border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'border-rose bg-rose/10 sm:bg-transparent text-txt'
                  : 'border-line bg-surface/30 sm:bg-transparent sm:border-transparent text-mut hover:text-txt'
              }`}
            >
              <tab.icon size={15} className={`shrink-0 ${activeTab === tab.id ? 'text-rose' : 'text-faint'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: QUICK CONNECT & CROSS-PLATFORM SETUP ── */}
        {activeTab === 'connect' && (
          <div className="space-y-5 sm:space-y-6 min-w-0">
            {/* Personal Memory Endpoint Card */}
            <div className="rounded-3xl border border-line glass p-4 sm:p-6 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3.5">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-display text-txt">Your Personal Memory Endpoint</h2>
                  <p className="text-xs text-mut mt-0.5">
                    Your personal MCP link. Paste this into Claude, Cursor, or any MCP client to connect your memory.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose/30 bg-rose/10 px-2.5 py-1 text-[11px] text-rose font-mono shrink-0">
                  <span className="h-2 w-2 rounded-full bg-rose animate-pulse" /> Ready to Connect
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-2xl border border-line bg-bg/80 p-3 font-mono text-xs text-mut min-w-0">
                <span className="truncate flex-1 min-w-0 text-[11px] sm:text-xs text-txt/90">
                  {`https://engram-pearl.vercel.app/mcp?token=${activeLiveKey.slice(0, 14)}••••••••&room=${activeRoom}`}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(defaultConnectorUrl, 'connectorUrl')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-3.5 py-2 text-xs font-sans font-medium text-bg shadow hover:opacity-95 transition"
                  >
                    {copiedText === 'connectorUrl' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedText === 'connectorUrl' ? 'Full Link Copied!' : '1-Tap Copy Full Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareTextOrUrl(
                        'My Engram MCP Connector Link',
                        'Use this MCP URL to connect Claude or Cursor to my Engram memory:',
                        defaultConnectorUrl,
                        'connectorUrl'
                      )
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-sans text-txt hover:border-rose/50 transition"
                    title="Share link to phone or another app"
                  >
                    <Share2 size={14} className="text-rose" />
                    <span className="sm:hidden md:inline">Share</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── MOBILE WORKFLOWS: INTERACTIVE 1-TAP PHONE SETUP HUB ── */}
            <div className="rounded-3xl border border-rose/30 glass p-4 sm:p-6 space-y-5 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/70 pb-4">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose/30 bg-rose/10 text-rose">
                    <Smartphone size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-display text-txt">Use Engram on Your Phone</h3>
                      <span className="rounded-full border border-rose/30 bg-rose/10 px-2 py-0.5 text-[10px] font-mono uppercase text-rose">
                        Beginner Guide
                      </span>
                    </div>
                    <p className="text-xs text-mut mt-0.5 leading-relaxed">
                      Save notes directly from this page, or connect your Claude / ChatGPT phone app so your AI remembers everything across your phone and laptop.
                    </p>
                  </div>
                </div>
              </div>

              {/* ALWAYS-VISIBLE: Instant Phone Quick-Save (Zero Setup!) */}
              <div className="rounded-2xl border border-rose/30 bg-rose/[0.04] p-3.5 sm:p-4 space-y-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-txt flex items-center gap-2">
                    <Zap size={15} className="text-rose shrink-0" />
                    Option 0 (Easiest): Save a Memory Right Here on Your Phone
                  </span>
                  <span className="text-[10.5px] font-mono text-rose">Zero setup required</span>
                </div>
                <p className="text-xs text-mut leading-relaxed">
                  Type or voice-dictate any fact or decision below and tap <strong className="text-txt">Save</strong>. Your laptop AI (Cursor, Claude, Antigravity) will immediately know it!
                </p>
                {quickMobileSuccess && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/15 p-2.5 text-xs text-rose">
                    <CheckCircle2 size={14} className="text-rose shrink-0" />
                    <span>{quickMobileSuccess}</span>
                  </div>
                )}
                <form onSubmit={handleQuickMobileSave} className="flex flex-col sm:flex-row gap-2 min-w-0">
                  <select
                    value={quickMobileType}
                    onChange={(e) => setQuickMobileType(e.target.value)}
                    className="rounded-xl border border-line bg-bg/90 px-3 py-2.5 text-xs font-mono text-txt focus:border-rose/50 focus:outline-none shrink-0"
                  >
                    <option value="decision">Decision</option>
                    <option value="config">Config / Setup</option>
                    <option value="gotcha">Gotcha / Fix</option>
                    <option value="person">Person / Team</option>
                    <option value="preference">Preference</option>
                    <option value="plan">Plan / Todo</option>
                  </select>
                  <input
                    type="text"
                    value={quickMobileText}
                    onChange={(e) => setQuickMobileText(e.target.value)}
                    placeholder="Type a note or decision to save to your memory…"
                    required
                    className="flex-1 min-w-0 rounded-xl border border-line bg-bg/90 px-3.5 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={quickMobileSaving}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 disabled:opacity-50 transition shrink-0"
                  >
                    <Send size={13} />
                    <span>{quickMobileSaving ? 'Saving…' : 'Save to My Memory'}</span>
                  </button>
                </form>
              </div>

              {/* 4 App Guides Selector Tabs */}
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-faint mb-2">
                  Want to connect a mobile chatbot app instead? Choose your app:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileMode('claude')}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                      mobileMode === 'claude'
                        ? 'border-rose bg-rose/15 text-txt shadow-sm'
                        : 'border-line bg-bg/50 text-mut hover:border-line-2 hover:text-txt'
                    }`}
                  >
                    <MessageSquare size={16} className={mobileMode === 'claude' ? 'text-rose shrink-0' : 'text-faint shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt truncate">1. Claude App</p>
                      <p className="text-[10.5px] text-faint truncate">1-link MCP connect</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileMode('chatgpt')}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                      mobileMode === 'chatgpt'
                        ? 'border-violet bg-violet/15 text-txt shadow-sm'
                        : 'border-line bg-bg/50 text-mut hover:border-line-2 hover:text-txt'
                    }`}
                  >
                    <Sparkles size={16} className={mobileMode === 'chatgpt' ? 'text-violet-soft shrink-0' : 'text-faint shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt truncate">2. ChatGPT App</p>
                      <p className="text-[10.5px] text-faint truncate">Custom Instructions</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileMode('gemini')}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                      mobileMode === 'gemini'
                        ? 'border-violet/60 bg-violet/10 text-txt shadow-sm'
                        : 'border-line bg-bg/50 text-mut hover:border-line-2 hover:text-txt'
                    }`}
                  >
                    <Sparkles size={16} className={mobileMode === 'gemini' ? 'text-violet-soft shrink-0' : 'text-faint shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt truncate">3. Google Gemini</p>
                      <p className="text-[10.5px] text-faint truncate">Gems & Mobile App</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileMode('shortcuts')}
                    className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition ${
                      mobileMode === 'shortcuts'
                        ? 'border-violet/60 bg-violet/10 text-txt shadow-sm'
                        : 'border-line bg-bg/50 text-mut hover:border-line-2 hover:text-txt'
                    }`}
                  >
                    <Zap size={16} className={mobileMode === 'shortcuts' ? 'text-violet-soft shrink-0' : 'text-faint shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt truncate">4. Shortcuts / Siri</p>
                      <p className="text-[10.5px] text-faint truncate">1-tap webhook</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* MODE 1: CLAUDE MOBILE & WEB */}
              {mobileMode === 'claude' && (
                <div className="space-y-4 rounded-2xl border border-line bg-bg/50 p-3.5 sm:p-5 min-w-0">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-txt">
                      Connect the Claude Phone App (Takes 30 Seconds)
                    </h4>
                    <p className="text-xs text-mut leading-relaxed">
                      Claude has built-in support for Engram. You only need to paste your link once on <strong className="text-txt">claude.ai</strong>, and your Claude iPhone/Android app will automatically have your memory!
                    </p>
                  </div>

                  {/* Step 1: Connector Link */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-txt flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-rose/20 text-rose font-mono text-[11px]">1</span>
                        Copy your Connector Link & paste into Claude Integrations
                      </span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-mut leading-relaxed">
                      <li>Tap <strong className="text-txt">"1-Tap Copy Connector Link"</strong> below.</li>
                      <li>Open <a href="https://claude.ai/settings" target="_blank" rel="noreferrer" className="text-rose underline">claude.ai/settings</a> in your browser → tap <strong className="text-txt">Integrations → Add More</strong>.</li>
                      <li>Name it <strong className="text-txt">Engram</strong> and paste the link. Done!</li>
                    </ol>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(defaultConnectorUrl, 'claudeLink')}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 transition"
                      >
                        {copiedText === 'claudeLink' ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedText === 'claudeLink' ? 'Connector Link Copied!' : '1-Tap Copy Connector Link'}</span>
                      </button>
                      <a
                        href="https://claude.ai/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-txt hover:border-rose/50 transition"
                      >
                        <span>Open Claude Settings</span>
                        <ExternalLink size={13} className="text-rose" />
                      </a>
                    </div>
                  </div>

                  {/* Step 2: System Prompt */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-txt flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-rose/20 text-rose font-mono text-[11px]">2</span>
                        Optional: Copy the Memory Rules Prompt
                      </span>
                    </div>
                    <p className="text-xs text-mut leading-relaxed">
                      Want Claude to automatically check and save memories without you having to say <em>"remember this"</em>? Copy this prompt and paste it into <strong className="text-txt">Claude Settings → Profile → Personal Preferences</strong>:
                    </p>
                    {showFullMobilePrompt && (
                      <div className="rounded-xl border border-line bg-bg/90 p-3 font-mono text-[11px] text-mut leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                        {ENGRAM_PROMPT}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ENGRAM_PROMPT, 'claudePrompt')}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border border-rose/40 bg-rose/15 px-4 py-2.5 text-xs font-medium text-txt hover:bg-rose/25 transition"
                      >
                        {copiedText === 'claudePrompt' ? <Check size={14} className="text-rose" /> : <Copy size={14} className="text-rose" />}
                        <span>{copiedText === 'claudePrompt' ? 'System Prompt Copied!' : '1-Tap Copy Memory Prompt'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFullMobilePrompt(!showFullMobilePrompt)}
                        className="text-xs font-mono text-mut hover:text-txt px-2.5 py-1.5"
                      >
                        {showFullMobilePrompt ? 'Hide prompt text' : 'View prompt text'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MODE 2: CHATGPT MOBILE APP (WORKS ON FREE & REGULAR CHATS!) */}
              {mobileMode === 'chatgpt' && (
                <div className="space-y-4 rounded-2xl border border-line bg-bg/50 p-3.5 sm:p-5 min-w-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-txt">
                        Use Engram in Regular ChatGPT Conversations (Works on Free & Mobile App!)
                      </h4>
                      <span className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[10px] font-mono text-violet-soft">
                        No Paid Plan Needed
                      </span>
                    </div>
                    <p className="text-xs text-mut leading-relaxed">
                      You do <strong className="text-txt">not</strong> need GPT Builder or a paid ChatGPT Plus account! This works in your normal ChatGPT Android/iPhone app using <strong className="text-txt">Custom Instructions</strong> + clickable <strong className="text-txt">1-Tap Save Links</strong>.
                    </p>
                  </div>

                  {/* Step 1: Free Custom Instructions */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <span className="text-xs font-semibold text-txt flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-soft font-mono text-[11px]">1</span>
                      One-Time Setup: Paste into ChatGPT Custom Instructions
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-mut leading-relaxed">
                      <li>Tap <strong className="text-txt">"1-Tap Copy Custom Instructions"</strong> below (sized under 1,500 chars to fit ChatGPT's limit).</li>
                      <li>Open your <strong className="text-txt">ChatGPT Android/iPhone App → Settings → Personalization → Custom Instructions</strong>.</li>
                      <li>Paste into <strong className="text-txt">"How would you like ChatGPT to respond?"</strong> and tap Save.</li>
                    </ol>
                    <p className="text-[11px] text-violet-soft font-mono">
                      ✨ How it works: Whenever you tell ChatGPT something worth keeping, ChatGPT will reply with a clickable "💾 Tap to Save to Engram" link right in the chat!
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(chatgptCustomInstructions, 'chatgptPrompt')}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 transition"
                    >
                      {copiedText === 'chatgptPrompt' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedText === 'chatgptPrompt' ? 'Instructions Copied!' : '1-Tap Copy Custom Instructions'}</span>
                    </button>
                  </div>

                  {/* Step 2: 1-Tap Copy Full Memory Vault into Any Chat */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <span className="text-xs font-semibold text-txt flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-soft font-mono text-[11px]">2</span>
                      Instant Memory Pack: Paste All {activeMemoriesList.length} Memories into Any Chat
                    </span>
                    <p className="text-xs text-mut leading-relaxed">
                      Starting a deep coding or planning chat in ChatGPT, Gemini, or DeepSeek on your phone? Tap below to copy all <strong className="text-txt">{activeMemoriesList.length} of your active memories</strong> + the 1-tap save rule, and paste it as your first message!
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullMemoryPackForChat, 'memoryPack')}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 py-2.5 text-xs font-medium text-txt hover:bg-violet/25 transition"
                    >
                      {copiedText === 'memoryPack' ? <Check size={14} className="text-rose" /> : <Sparkles size={14} className="text-violet-soft" />}
                      <span>
                        {copiedText === 'memoryPack'
                          ? `All ${activeMemoriesList.length} Memories Copied!`
                          : `1-Tap Copy All ${activeMemoriesList.length} Memories for Chat`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 3: GOOGLE GEMINI (GEMS & MOBILE APP) */}
              {mobileMode === 'gemini' && (
                <div className="space-y-4 rounded-2xl border border-line bg-bg/50 p-3.5 sm:p-5 min-w-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-txt">
                        Connect Google Gemini (Gemini Gems & Mobile App)
                      </h4>
                      <span className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 text-[10px] font-mono text-violet-soft">
                        Works on Web, Android & iOS
                      </span>
                    </div>
                    <p className="text-xs text-mut leading-relaxed">
                      Google Gemini lets you create custom <strong className="text-txt">Gems</strong> that have their own persistent instructions. Once created, your Gem lives in your Gemini mobile app sidebar!
                    </p>
                  </div>

                  {/* Step 1: Create a Gem */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <span className="text-xs font-semibold text-txt flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose/20 text-rose font-mono text-[11px]">1</span>
                      Create an "Engram Memory" Gem in 1 Minute
                    </span>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-mut leading-relaxed">
                      <li>Open <a href="https://gemini.google.com/gems" target="_blank" rel="noreferrer" className="text-rose underline">gemini.google.com/gems</a> (or open Gemini App → tap Gems → New Gem).</li>
                      <li>Name your Gem: <strong className="text-txt">Engram Brain</strong>.</li>
                      <li>Tap the button below to copy your tailored Gem Instructions, then paste it into the <strong className="text-txt">Instructions</strong> box.</li>
                      <li>Tap <strong className="text-txt">Save</strong>. Done! Now Gemini automatically checks your memories and outputs 1-tap save links!</li>
                    </ol>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(geminiGemInstructions, 'geminiInstructions')}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 transition"
                      >
                        {copiedText === 'geminiInstructions' ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedText === 'geminiInstructions' ? 'Gem Instructions Copied!' : '1-Tap Copy Gem Instructions'}</span>
                      </button>
                      <a
                        href="https://gemini.google.com/gems"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs text-txt hover:border-rose/50 transition"
                      >
                        <span>Open Gemini Gems</span>
                        <ExternalLink size={13} className="text-rose" />
                      </a>
                    </div>
                  </div>

                  {/* Step 2: Instant Memory Pack for Gemini Regular / Live */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <span className="text-xs font-semibold text-txt flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet/20 text-violet-soft font-mono text-[11px]">2</span>
                      Gemini Live & Regular Chats: Paste Memory Pack
                    </span>
                    <p className="text-xs text-mut leading-relaxed">
                      Starting a fresh conversation or voice session on Gemini Live? Tap below to copy all {activeMemoriesList.length} active memories + save link rules in one clean prompt:
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullMemoryPackForChat, 'geminiMemoryPack')}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-violet/40 bg-violet/15 px-4 py-2.5 text-xs font-medium text-txt hover:bg-violet/25 transition"
                    >
                      {copiedText === 'geminiMemoryPack' ? <Check size={14} className="text-rose" /> : <Sparkles size={14} className="text-violet-soft" />}
                      <span>
                        {copiedText === 'geminiMemoryPack'
                          ? `All ${activeMemoriesList.length} Memories Copied!`
                          : `1-Tap Copy All ${activeMemoriesList.length} Memories for Gemini`}
                      </span>
                    </button>
                  </div>

                  {/* Step 3: Google Antigravity & Gemini CLI (Developer Setup) */}
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-2.5 min-w-0">
                    <span className="text-xs font-semibold text-txt flex items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose/20 text-rose font-mono text-[11px]">3</span>
                      Developer: Google Antigravity & Gemini CLI (MCP)
                    </span>
                    <p className="text-xs text-mut leading-relaxed">
                      If you use the Gemini CLI or Antigravity IDE, paste this into your local <code className="text-rose font-mono">~/.gemini/settings.json</code> or <code className="text-rose font-mono">mcp_servers.json</code>:
                    </p>
                    <pre className="overflow-x-auto rounded-xl border border-line bg-bg/90 p-3 font-mono text-[11px] text-txt leading-relaxed">
                      {geminiMcpSnippet}
                    </pre>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(geminiMcpSnippet, 'geminiMcp')}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-2 px-3 text-xs text-txt hover:border-rose/50 transition"
                    >
                      {copiedText === 'geminiMcp' ? <Check size={14} className="text-rose" /> : <Copy size={14} />}
                      <span>{copiedText === 'geminiMcp' ? 'Snippet Copied!' : 'Copy Gemini CLI MCP Config'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 4: iOS SHORTCUTS / ANDROID WEBHOOK */}
              {mobileMode === 'shortcuts' && (
                <div className="space-y-4 rounded-2xl border border-line bg-bg/50 p-3.5 sm:p-5 min-w-0">
                  <div className="rounded-2xl border border-line bg-surface/40 p-3.5 space-y-3 min-w-0">
                    <div>
                      <h4 className="text-xs font-semibold text-txt">
                        Optional: Apple iOS Shortcuts & Android Webhook (For Advanced Automation)
                      </h4>
                      <p className="text-xs text-mut mt-0.5 leading-relaxed">
                        If you want to build an iPhone Siri Shortcut (<strong className="text-txt">"Get Contents of URL"</strong>, Method: <code className="text-rose font-mono">POST</code>), copy each field below in 1 tap:
                      </p>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 min-w-0">
                      {/* Endpoint URL */}
                      <div className="rounded-xl border border-line bg-bg/80 p-3 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-mono uppercase text-faint">1. Endpoint URL (POST)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('https://engram-pearl.vercel.app/api/remember', 'shortcutUrl')}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-txt hover:border-rose/50"
                          >
                            {copiedText === 'shortcutUrl' ? <Check size={12} className="text-rose" /> : <Copy size={12} />}
                            <span>{copiedText === 'shortcutUrl' ? 'Copied!' : 'Copy URL'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-txt break-all">
                          https://engram-pearl.vercel.app/api/remember
                        </p>
                      </div>

                      {/* Authorization Header */}
                      <div className="rounded-xl border border-line bg-bg/80 p-3 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-mono uppercase text-faint">2. Header: Authorization</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`Bearer ${activeLiveKey}`, 'shortcutAuth')}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-txt hover:border-rose/50"
                          >
                            {copiedText === 'shortcutAuth' ? <Check size={12} className="text-rose" /> : <Copy size={12} />}
                            <span>{copiedText === 'shortcutAuth' ? 'Copied!' : 'Copy Header'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-[11px] text-mut truncate">
                          Bearer {activeLiveKey.slice(0, 14)}••••••••
                        </p>
                      </div>
                    </div>

                    {/* JSON Body & cURL Buttons */}
                    <div className="grid gap-2.5 sm:grid-cols-2 min-w-0">
                      <div className="rounded-xl border border-line bg-bg/80 p-3 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-mono uppercase text-faint">3. Request Body (JSON)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(shortcutJsonTemplate, 'shortcutJson')}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-txt hover:border-rose/50"
                          >
                            {copiedText === 'shortcutJson' ? <Check size={12} className="text-rose" /> : <Copy size={12} />}
                            <span>{copiedText === 'shortcutJson' ? 'Copied!' : 'Copy JSON'}</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto font-mono text-[11px] text-mut leading-snug">
                          {shortcutJsonTemplate}
                        </pre>
                      </div>

                      <div className="rounded-xl border border-line bg-bg/80 p-3 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-mono uppercase text-faint">4. Ready-to-Run cURL</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(shortcutCurlSnippet, 'shortcutCurl')}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-txt hover:border-rose/50"
                          >
                            {copiedText === 'shortcutCurl' ? <Check size={12} className="text-rose" /> : <Copy size={12} />}
                            <span>{copiedText === 'shortcutCurl' ? 'Copied!' : 'Copy cURL'}</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto font-mono text-[10.5px] text-mut leading-snug">
                          {shortcutCurlSnippet}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 1-Click Client Configuration Generators */}
            <div className="rounded-3xl border border-line glass p-4 sm:p-6 space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-display text-txt flex items-center gap-2">
                    <Download size={16} className="text-rose shrink-0" /> 1-Click Desktop Config Generators
                  </h3>
                  <p className="text-xs text-mut mt-0.5">
                    Download ready-to-use JSON config files pre-populated with your live API key.
                  </p>
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => downloadClientConfig('claude')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface/40 p-3 text-xs font-mono text-txt hover:border-rose/50 hover:bg-rose/[0.04] transition min-w-0"
                >
                  <Laptop size={15} className="text-rose shrink-0" />
                  <span className="truncate">claude_desktop_config.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadClientConfig('cursor')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface/40 p-3 text-xs font-mono text-txt hover:border-violet/50 hover:bg-violet/[0.04] transition min-w-0"
                >
                  <Laptop size={15} className="text-violet-soft shrink-0" />
                  <span className="truncate">.cursor/mcp.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadClientConfig('antigravity')}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface/40 p-3 text-xs font-mono text-txt hover:border-violet/50 hover:bg-violet/[0.04] transition min-w-0"
                >
                  <Terminal size={15} className="text-violet-soft shrink-0" />
                  <span className="truncate">mcp_servers.json (AGY / Gemini)</span>
                </button>
              </div>
            </div>

            {/* Desktop & CLI Setup Guides */}
            <div className="grid gap-5 md:grid-cols-2 min-w-0">
              {/* Cursor & Claude Desktop Setup */}
              <div className="rounded-3xl border border-line glass p-4 sm:p-6 min-w-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-violet/30 bg-violet/10 text-violet-soft">
                    <Laptop size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-display text-txt">Cursor & Claude Desktop</h3>
                    <p className="text-xs text-mut">Paste into your local MCP configuration file</p>
                  </div>
                </div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint truncate">
                  claude_desktop_config.json / .cursor/mcp.json
                </p>
                <pre className="max-w-full overflow-x-auto rounded-2xl border border-line bg-bg/70 p-3.5 font-mono text-[11px] text-txt leading-relaxed">
{`{
  "mcpServers": {
    "engram": {
      "url": "https://engram-pearl.vercel.app/mcp?token=${activeLiveKey.slice(0, 14)}••••&room=${activeRoom}"
    }
  }
}`}
                </pre>
                <button
                  type="button"
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
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface/50 py-2.5 text-xs text-txt hover:border-violet/50 transition"
                >
                  {copiedText === 'mcpJson' ? <Check size={14} className="text-rose" /> : <Copy size={14} />}
                  {copiedText === 'mcpJson' ? 'Config Copied!' : '1-Tap Copy MCP JSON Config'}
                </button>
              </div>

              {/* CLI & Terminal Setup */}
              <div className="rounded-3xl border border-line glass p-4 sm:p-6 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-rose/30 bg-rose/10 text-rose">
                      <Terminal size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-display text-txt">Terminal, Antigravity & Windsurf</h3>
                      <p className="text-xs text-mut">Run the official verified npm package via stdio</p>
                    </div>
                  </div>
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-faint">
                    NPX Command (Pre-filled with your live key)
                  </p>
                  <div className="rounded-2xl border border-line bg-bg/80 p-3.5 font-mono text-[11px] text-txt truncate leading-relaxed">
                    npx -y engram-walrus --key={activeLiveKey.slice(0, 14)}••••••••
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(`npx -y engram-walrus --key=${activeLiveKey}`, 'npmCmd')
                  }
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface/50 py-2.5 text-xs text-txt hover:border-rose/50 transition"
                >
                  {copiedText === 'npmCmd' ? <Check size={14} className="text-rose" /> : <Copy size={14} />}
                  {copiedText === 'npmCmd' ? 'NPX Command Copied!' : '1-Tap Copy NPX Command'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: API KEYS ── */}
        {activeTab === 'keys' && (
          <div className="space-y-5 sm:space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-display text-txt">API Credentials & Keys</h2>
                <p className="text-xs text-mut mt-0.5">
                  Generate scoped keys for your personal devices or team workspaces. Copy any key or MCP URL in 1 tap.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedKeyRaw(null)
                  setShowKeyModal(true)
                }}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose to-violet px-4 py-2.5 text-xs font-medium text-bg shadow hover:opacity-90 transition w-full sm:w-auto shrink-0"
              >
                <Plus size={14} /> Generate New Key
              </button>
            </div>

            {keys.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line p-8 sm:p-10 text-center">
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
              <>
                {/* Mobile Stacked Cards (< md) */}
                <div className="space-y-3 md:hidden">
                  {keys.map((k) => {
                    const keyToken = k.liveKey || activeLiveKey
                    return (
                      <div key={k.id} className="rounded-2xl border border-line glass p-4 space-y-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-txt truncate">{k.name}</p>
                            <p className="font-mono text-[11px] text-faint mt-0.5">
                              Room: <span className="text-mut">{k.room}</span> · {new Date(k.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase font-mono tracking-wide shrink-0 ${
                              k.scope === 'personal'
                                ? 'border border-rose/30 bg-rose/10 text-rose'
                                : 'border border-violet/30 bg-violet/10 text-violet-soft'
                            }`}
                          >
                            {k.scope}
                          </span>
                        </div>

                        <div className="rounded-xl border border-line bg-bg/70 px-3 py-2 font-mono text-[11px] text-mut break-all">
                          {k.connectorUrl}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(k.connectorUrl, `url-${k.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose to-violet px-3 py-2 text-xs font-medium text-bg shadow"
                          >
                            {copiedText === `url-${k.id}` ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedText === `url-${k.id}` ? 'Link Copied!' : 'Copy Link'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(keyToken, `key-${k.id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-txt hover:border-rose/40"
                          >
                            {copiedText === `key-${k.id}` ? <Check size={13} className="text-rose" /> : <Key size={13} className="text-rose" />}
                            <span>{copiedText === `key-${k.id}` ? 'Key Copied!' : 'Copy API Key'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeKey(k.id)}
                            className="rounded-xl border border-line bg-surface p-2 text-rose-400 hover:border-rose-400 transition"
                            title="Revoke Key"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table (md+) */}
                <div className="hidden md:block rounded-3xl border border-line glass overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-surface/40 text-faint font-mono uppercase tracking-wider text-[10.5px]">
                          <th className="px-5 py-3.5">Name</th>
                          <th className="px-5 py-3.5">Key Prefix</th>
                          <th className="px-5 py-3.5">Scope</th>
                          <th className="px-5 py-3.5">Room</th>
                          <th className="px-5 py-3.5">Created</th>
                          <th className="px-5 py-3.5 text-right">1-Tap Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {keys.map((k) => {
                          const keyToken = k.liveKey || activeLiveKey
                          return (
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
                                    onClick={() => copyToClipboard(keyToken, `key-${k.id}`)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/50 px-2.5 py-1.5 text-xs text-txt hover:border-rose/40 transition"
                                    title="Copy Live API Key"
                                  >
                                    {copiedText === `key-${k.id}` ? <Check size={13} className="text-rose" /> : <Key size={13} className="text-rose" />}
                                    <span>{copiedText === `key-${k.id}` ? 'Copied!' : 'Copy Key'}</span>
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(k.connectorUrl, k.id)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/50 px-2.5 py-1.5 text-xs text-txt hover:border-rose/40 transition"
                                    title="Copy MCP Connector URL"
                                  >
                                    {copiedText === k.id ? <Check size={13} className="text-rose" /> : <Copy size={13} />}
                                    <span>{copiedText === k.id ? 'Copied!' : 'Copy Link'}</span>
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
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
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
                        <span className={teamMembers.length >= 3 ? 'text-amber-400 font-bold' : 'text-violet-soft font-bold'}>
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
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose">
                          <AlertCircle size={15} className="shrink-0 text-rose" />
                          <span>{inviteError}</span>
                        </div>
                      )}

                      {inviteSuccess && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/10 p-3 text-xs text-violet-soft">
                          <CheckCircle2 size={15} className="shrink-0 text-violet-soft" />
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
        {activeTab === 'usage' && (() => {
          const personalSaves = usage?.personal.saves ?? 0
          const personalLimit = usage?.personal.dailyLimit ?? 50
          const personalPercent = usage?.personal.percentUsed ?? Math.min(100, Math.round((personalSaves / personalLimit) * 100))
          const personalRemaining = usage?.personal.remaining ?? Math.max(0, personalLimit - personalSaves)
          const personalReset = formatCountdown(usage?.personal.secondsUntilReset)

          const activeTeamUsage = usage?.teams?.find(t => t.teamId === selectedTeam?.id) || usage?.teams?.[0]
          const teamSaves = activeTeamUsage?.saves ?? 0
          const teamLimit = activeTeamUsage?.dailyLimit ?? 150
          const teamPercent = activeTeamUsage?.percentUsed ?? Math.min(100, Math.round((teamSaves / teamLimit) * 100))
          const teamRemaining = activeTeamUsage?.remaining ?? Math.max(0, teamLimit - teamSaves)

          return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-display text-txt">Usage Limits & Quotas</h2>
                  <p className="text-xs text-mut mt-0.5">
                    Real-time daily write counters and quota enforcement. Daily quotas reset at 00:00 UTC.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface/70 px-3.5 py-1.5 font-mono text-[11px] text-mut">
                  <span className="h-2 w-2 rounded-full bg-rose animate-pulse" />
                  <span>Resets in: <strong className="text-txt">{personalReset}</strong></span>
                </div>
              </div>

              {/* Quota Threshold Warnings */}
              {personalSaves >= personalLimit ? (
                <div className="rounded-2xl border border-rose/40 bg-rose/10 p-4 text-xs text-rose flex items-start gap-3">
                  <AlertCircle size={18} className="text-rose shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose">Personal Daily Quota Exhausted ({personalSaves}/{personalLimit} saves)</p>
                    <p className="text-[11.5px] mt-0.5 text-rose/90">
                      Your connected agents have reached today's 50 memory save limit. Read/recall operations remain active.
                      Save quota will automatically unlock in {personalReset} (midnight UTC).
                    </p>
                  </div>
                </div>
              ) : personalPercent >= 80 ? (
                <div className="rounded-2xl border border-violet/40 bg-violet/10 p-4 text-xs text-violet-soft flex items-start gap-3">
                  <AlertCircle size={18} className="text-violet-soft shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-violet-soft">Approaching Daily Quota ({personalSaves}/{personalLimit} saves - {personalPercent}%)</p>
                    <p className="text-[11.5px] mt-0.5 text-violet-soft/90">
                      You have {personalRemaining} memory saves remaining today. Quota resets at midnight UTC.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Daily Save Progress Bars */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-3xl border border-line glass p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-rose" />
                      <h3 className="font-medium text-sm text-txt">Personal Daily Saves</h3>
                    </div>
                    <span className="font-mono text-xs text-rose font-bold">
                      {personalSaves} / {personalLimit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full transition-all duration-500 bg-gradient-to-r from-rose to-violet"
                      style={{ width: `${personalPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-faint font-mono">
                    <span>{personalRemaining} saves remaining</span>
                    <span>{personalPercent}% used</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-line glass p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-violet-soft" />
                      <h3 className="font-medium text-sm text-txt">
                        Team Daily Saves {selectedTeam ? `(${selectedTeam.name})` : ''}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-violet-soft font-bold">
                      {teamSaves} / {teamLimit}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full transition-all duration-500 bg-gradient-to-r from-rose to-violet"
                      style={{ width: `${teamPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-faint font-mono">
                    <span>{teamRemaining} saves remaining</span>
                    <span>{teamPercent}% used</span>
                  </div>
                </div>
              </div>

              {/* Team Member Limit Card */}
              {selectedTeam && (
                <div className="rounded-3xl border border-line glass p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-rose" />
                      <h3 className="font-medium text-sm text-txt">Free Team Seat Ceiling</h3>
                    </div>
                    <span className="font-mono text-xs text-rose font-bold">
                      {teamMembers.length} / 3 Members
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full transition-all duration-500 bg-gradient-to-r from-rose to-violet"
                      style={{ width: `${Math.min(100, (teamMembers.length / 3) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-[11px] text-faint font-mono">
                    {teamMembers.length >= 3
                      ? 'Maximum capacity reached (3/3 members). Upgrade to Pro to invite additional developers.'
                      : `${3 - teamMembers.length} invite slot(s) remaining on Free Team Plan.`}
                  </p>
                </div>
              )}

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
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> 1 User Account</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> 50 Saves / Day</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Cross-device sync (Mobile, Desktop, CLI)</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Seal-encrypted Walrus storage</li>
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
                      <li className="flex items-center gap-2 font-semibold text-txt"><Check size={14} className="text-rose" /> Up to 3 Team Members</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> 150 Saves / Day (Shared)</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> 1 Shared Team Memory Space</li>
                      <li className="flex items-center gap-2"><Check size={14} className="text-rose" /> Role-based access (Owner, Member)</li>
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
        )
      })()}

        {/* ── TAB 5: MEMORY EXPLORER ── */}
        {activeTab === 'memories' && (
          <div className="space-y-5 sm:space-y-6 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-display text-txt flex items-center gap-2">
                  <Search size={19} className="text-rose shrink-0" />
                  <span>Memory Explorer & Walrus Verification</span>
                </h2>
                <p className="text-xs text-mut mt-0.5 leading-relaxed">
                  Inspect memories stored on Walrus decentralized storage. Filter by taxonomy, detect superseded architectural choices, and verify on-chain proofs.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-2xl border border-line bg-surface/40 p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setMemoryViewMode('cards')}
                    className={`rounded-xl px-2.5 py-1 transition ${
                      memoryViewMode === 'cards' ? 'bg-rose/15 text-rose font-semibold' : 'text-mut hover:text-txt'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoryViewMode('graph')}
                    className={`rounded-xl px-2.5 py-1 transition ${
                      memoryViewMode === 'graph' ? 'bg-violet/20 text-violet-soft font-semibold' : 'text-mut hover:text-txt'
                    }`}
                  >
                    Graph Web
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleTidyMemories}
                  disabled={!memories.length}
                  className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface/50 px-3 py-1.5 text-xs text-txt hover:border-rose/50 transition disabled:opacity-40"
                  title="Scan and deduplicate memories"
                >
                  <Sparkles size={13} className="text-rose" /> Tidy
                </button>
                <button
                  type="button"
                  onClick={() => exportMemories('json')}
                  disabled={!memories.length}
                  className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface/50 px-3 py-1.5 text-xs text-txt hover:border-rose/50 transition disabled:opacity-40"
                  title="Export all memories as JSON"
                >
                  <Download size={13} className="text-rose" /> JSON
                </button>
                <button
                  type="button"
                  onClick={() => exportMemories('markdown')}
                  disabled={!memories.length}
                  className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface/50 px-3 py-1.5 text-xs text-txt hover:border-violet/50 transition disabled:opacity-40"
                  title="Export all memories as Markdown"
                >
                  <FileText size={13} className="text-violet-soft" /> Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMemoryModal(true)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-rose to-violet px-3.5 py-1.5 text-xs font-medium text-bg shadow hover:opacity-95 transition shrink-0"
                >
                  <Plus size={14} /> Pin Memory
                </button>
              </div>
            </div>

            {/* Superseded Notification Banner */}
            {supersededNotice && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span className="break-words">{supersededNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSupersededNotice(null)}
                  className="text-amber-400 hover:underline font-mono text-[11px] shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* On-Chain Walrus Epoch & Staking Metrics Bar (2x2 on mobile, 4-col on desktop) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-line glass p-3.5 sm:p-4 space-y-1 min-w-0">
                <div className="flex items-center justify-between text-faint text-[10.5px] sm:text-[11px]">
                  <span className="font-mono uppercase truncate">Walrus Epoch</span>
                  <Clock size={13} className="text-rose shrink-0" />
                </div>
                <p className="text-base sm:text-lg font-mono font-bold text-txt">
                  Epoch 24
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-mut truncate">
                  {user?.plan_tier === 'pro' || user?.plan_tier === 'team'
                    ? 'Permanent Staking Pool'
                    : '~14 days left (Testnet)'}
                </p>
              </div>

              <div className="rounded-2xl border border-line glass p-3.5 sm:p-4 space-y-1 min-w-0">
                <div className="flex items-center justify-between text-faint text-[10.5px] sm:text-[11px]">
                  <span className="font-mono uppercase truncate">Total WAL Staked</span>
                  <Coins size={13} className="text-violet-soft shrink-0" />
                </div>
                <p className="text-base sm:text-lg font-mono font-bold text-violet-soft truncate">
                  {memoryStats?.totalWalStaked ?? (memories.length * 0.002).toFixed(3)} WAL
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-mut truncate">128 KiB per blob</p>
              </div>

              <div className="rounded-2xl border border-line glass p-3.5 sm:p-4 space-y-1 min-w-0">
                <div className="flex items-center justify-between text-faint text-[10.5px] sm:text-[11px]">
                  <span className="font-mono uppercase truncate">Ground Truth</span>
                  <CheckCircle2 size={13} className="text-rose shrink-0" />
                </div>
                <p className="text-base sm:text-lg font-mono font-bold text-rose">
                  {memoryStats?.active ?? memories.filter((m) => !m.isSuperseded).length}
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-mut truncate">Active memories</p>
              </div>

              <div className="rounded-2xl border border-line glass p-3.5 sm:p-4 space-y-1 min-w-0">
                <div className="flex items-center justify-between text-faint text-[10.5px] sm:text-[11px]">
                  <span className="font-mono uppercase truncate">Conflict Engine</span>
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                </div>
                <p className="text-base sm:text-lg font-mono font-bold text-amber-400">
                  {memoryStats?.superseded ?? memories.filter((m) => m.isSuperseded).length}
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-mut truncate">Superseded choices</p>
              </div>
            </div>

            {/* Search & Scope form */}
            <form onSubmit={handleSearchMemories} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 min-w-0">
              <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
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

              <div className="relative flex-1 min-w-0">
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
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose to-violet px-5 py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 transition shrink-0"
              >
                {searching ? 'Querying Walrus…' : 'Filter / Search'}
              </button>
            </form>

            {/* Taxonomy Filter Pills & Superseded Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Types' },
                  { id: 'decision', label: 'Decisions', color: 'text-rose' },
                  { id: 'config', label: 'Configs', color: 'text-sky-400' },
                  { id: 'gotcha', label: 'Gotchas', color: 'text-amber-400' },
                  { id: 'person', label: 'People', color: 'text-rose-300' },
                  { id: 'preference', label: 'Preferences', color: 'text-pink-400' },
                  { id: 'plan', label: 'Plans', color: 'text-violet-soft' },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setTypeFilter(pill.id)}
                    className={`rounded-xl border px-2.5 py-1 text-[11px] font-mono transition ${
                      typeFilter === pill.id
                        ? 'border-rose/60 bg-rose/15 text-txt font-semibold'
                        : 'border-line/70 bg-surface/30 text-mut hover:border-line hover:text-txt'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowSuperseded(!showSuperseded)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[11px] font-mono transition ${
                  showSuperseded
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-line bg-surface/30 text-faint hover:text-mut'
                }`}
              >
                {showSuperseded ? <Eye size={12} /> : <EyeOff size={12} />}
                <span>{showSuperseded ? 'Showing Superseded' : 'Superseded Hidden'}</span>
              </button>
            </div>

            {/* Memories Results */}
            {memories.length === 0 ? (
              <div className="rounded-3xl border border-line glass p-8 text-center text-xs text-mut">
                <Layers size={28} className="mx-auto text-faint mb-2.5" />
                <p>No memories found matching this query or filter.</p>
                <p className="text-[11px] text-faint mt-1">
                  Connect your AI client via MCP or click "Pin Memory" to anchor your first decision.
                </p>
              </div>
            ) : memoryViewMode === 'graph' ? (
              <div className="rounded-3xl border border-line glass p-4 sm:p-7 space-y-4 sm:space-y-5 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3.5">
                  <div>
                    <h3 className="text-base font-display text-txt">Semantic Memory Constellation</h3>
                    <p className="text-xs text-mut">Tap any node in your Walrus knowledge web to inspect its full content and on-chain blob proof.</p>
                  </div>
                  <span className="font-mono text-[11px] text-faint shrink-0">{memories.length} nodes anchored</span>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-line bg-bg/90 p-2 sm:p-3">
                  <svg viewBox="0 0 640 420" className="w-full h-[260px] sm:h-[380px]">
                    <defs>
                      <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="320" cy="210" r="150" fill="url(#coreGlow)" />
                    <circle cx="320" cy="210" r="95" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                    <circle cx="320" cy="210" r="170" fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

                    {memories.slice(0, 48).map((m, idx, arr) => {
                      const angle = (idx / arr.length) * Math.PI * 2
                      const ring = idx % 2 === 0 ? 108 : 165
                      const x = 320 + Math.cos(angle) * ring * 1.18
                      const y = 210 + Math.sin(angle) * ring * 0.92
                      const strokeMap: Record<string, string> = {
                        decision: '#fb7185',
                        config: '#38bdf8',
                        gotcha: '#fbbf24',
                        person: '#f472b6',
                        preference: '#c084fc',
                        plan: '#34d399',
                      }
                      const col = strokeMap[m.type] || '#fb7185'
                      const isSel = selectedGraphNode?.id === m.id && selectedGraphNode?.text === m.text
                      return (
                        <g
                          key={m.id || idx}
                          onClick={() => setSelectedGraphNode(m)}
                          className="cursor-pointer transition-opacity hover:opacity-100"
                          style={{ opacity: m.isSuperseded ? 0.4 : 0.92 }}
                        >
                          <line
                            x1="320"
                            y1="210"
                            x2={x}
                            y2={y}
                            stroke={col}
                            strokeOpacity={isSel ? 0.75 : 0.22}
                            strokeWidth={isSel ? 2 : 1}
                          />
                          <circle
                            cx={x}
                            cy={y}
                            r={isSel ? 9 : 6}
                            fill={col}
                            stroke="#09070f"
                            strokeWidth="2"
                          />
                          <text
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                            fill="rgba(246,242,255,0.78)"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {m.type}
                          </text>
                        </g>
                      )
                    })}

                    {/* Center Core Node */}
                    <circle cx="320" cy="210" r="24" fill="#161124" stroke="#fb7185" strokeWidth="2" />
                    <text x="320" y="213" textAnchor="middle" fill="#f6f2ff" fontSize="10" fontFamily="monospace" fontWeight="bold">
                      ENGRAM
                    </text>
                  </svg>
                </div>

                {selectedGraphNode && (
                  <div className="rounded-2xl border border-rose/30 bg-surface/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                    <div className="space-y-1 min-w-0">
                      <span className="rounded-full border border-rose/40 bg-rose/10 px-2 py-0.5 text-[10px] font-mono uppercase text-rose">
                        {selectedGraphNode.type}
                      </span>
                      <p className="text-xs text-txt leading-relaxed mt-1 break-words">{selectedGraphNode.text}</p>
                    </div>
                    {selectedGraphNode.blobId && (
                      <a
                        href={`https://walruscan.com/testnet/blob/${selectedGraphNode.blobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-line bg-bg px-3 py-1.5 font-mono text-[11px] text-rose hover:border-rose/50"
                      >
                        Blob: {selectedGraphNode.blobId.slice(0, 8)}… <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 min-w-0">
                {memories.map((m, idx) => {
                  const typeColors: Record<string, string> = {
                    decision: 'border-rose/30 bg-rose/10 text-rose',
                    config: 'border-sky-400/30 bg-sky-400/10 text-sky-400',
                    gotcha: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
                    person: 'border-rose-300/30 bg-rose-300/10 text-rose-300',
                    preference: 'border-pink-400/30 bg-pink-400/10 text-pink-400',
                    plan: 'border-violet/30 bg-violet/10 text-violet-soft',
                  }
                  const pillClass = typeColors[m.type] || 'border-rose/30 bg-rose/10 text-rose'

                  return (
                    <div
                      key={m.id || idx}
                      className={`rounded-3xl border p-4 sm:p-5 space-y-3 transition min-w-0 overflow-hidden ${
                        m.isSuperseded
                          ? 'border-amber-500/30 bg-amber-500/[0.03] opacity-85'
                          : 'border-line glass'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase font-bold ${pillClass}`}>
                            {m.type || 'decision'}
                          </span>
                          {m.isSuperseded && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono text-amber-300 flex items-center gap-1">
                              <AlertTriangle size={10} /> SUPERSEDED
                            </span>
                          )}
                        </div>

                        <span className="flex items-center gap-1 font-mono text-[10px] text-faint shrink-0">
                          <Clock size={11} className="text-faint" />
                          {m.epochMeta?.daysRemaining ? `~${m.epochMeta.daysRemaining}d left` : 'Epoch 24'}
                        </span>
                      </div>

                      {/* Conflict Notification Box */}
                      {m.isSuperseded && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-300/90 font-mono break-words">
                          ⚠️ Superseded by newer decision {m.supersededBy ? `(blob: ${m.supersededBy.slice(0, 10)}…)` : ''}
                        </div>
                      )}

                      <p className={`text-xs text-txt leading-relaxed break-words ${m.isSuperseded ? 'line-through text-mut' : ''}`}>
                        {m.text}
                      </p>

                      <div className="border-t border-line/60 pt-2.5 flex items-center justify-between gap-2 text-[11px] text-faint">
                        <div className="flex items-center gap-1.5 truncate">
                          <Coins size={11} className="text-violet-soft shrink-0" />
                          <span className="truncate">0.002 WAL · 128 KiB</span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.text, `mem-${m.id || idx}`)}
                            className="flex items-center gap-1 font-mono text-faint hover:text-txt transition"
                            title="Copy memory text"
                          >
                            {copiedText === `mem-${m.id || idx}` ? (
                              <Check size={12} className="text-rose" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          {m.blobId && (
                            <a
                              href={`https://walruscan.com/testnet/blob/${m.blobId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 font-mono text-faint hover:text-rose transition"
                              title="Verify on Walruscan"
                            >
                              <span>Proof: {m.blobId.slice(0, 6)}…</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMemory(m.id, m.blobId)}
                            className="text-faint hover:text-rose transition p-1"
                            title="Delete memory"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                <div className="rounded-2xl border border-rose/30 bg-rose/10 p-3.5 text-xs text-rose">
                  <p className="font-semibold mb-1">Key Created! Copy it now.</p>
                  <p className="text-[11px] text-rose/80">
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
                      {copiedText === 'rawKey' ? <Check size={14} className="text-rose" /> : <Copy size={14} />}
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
                        {copiedText === 'rawUrl' ? <Check size={14} className="text-rose" /> : <Copy size={14} />}
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

      {/* ── MODAL: SAVE / PIN MEMORY ── */}
      {showAddMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line glass p-6 shadow-2xl">
            <h3 className="text-xl font-display text-txt mb-1">Pin Memory to Walrus</h3>
            <p className="text-xs text-mut mb-4">
              Manually store a durable memory directly into your connected Walrus storage.
            </p>

            {saveMemoryError && (
              <div className="mb-4 rounded-2xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose">
                {saveMemoryError}
              </div>
            )}

            <form onSubmit={handleSaveMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-mut mb-1">Memory Content</label>
                <textarea
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  placeholder="e.g. Switched database to Supabase PostgreSQL on 2026-10-31 because local SQLite doesn't sync across devices."
                  required
                  rows={3}
                  className="w-full rounded-2xl border border-line bg-bg/80 px-4 py-2.5 text-xs text-txt placeholder:text-faint focus:border-rose/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-mut mb-1">Type</label>
                  <select
                    value={newMemoryType}
                    onChange={(e) => setNewMemoryType(e.target.value)}
                    className="w-full rounded-2xl border border-line bg-bg/80 px-3 py-2 text-xs text-txt focus:border-rose/50 focus:outline-none"
                  >
                    <option value="decision">decision</option>
                    <option value="config">config</option>
                    <option value="gotcha">gotcha</option>
                    <option value="person">person</option>
                    <option value="preference">preference</option>
                    <option value="plan">plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-mut mb-1">Scope</label>
                  <select
                    value={newMemoryScope}
                    onChange={(e) => setNewMemoryScope(e.target.value as 'personal' | 'team')}
                    className="w-full rounded-2xl border border-line bg-bg/80 px-3 py-2 text-xs text-txt focus:border-rose/50 focus:outline-none"
                  >
                    <option value="personal">personal</option>
                    <option value="team">team</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemoryModal(false)}
                  className="flex-1 rounded-full border border-line py-2.5 text-xs text-mut hover:text-txt"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMemory}
                  className="flex-1 rounded-full bg-gradient-to-r from-rose to-violet py-2.5 text-xs font-medium text-bg shadow hover:opacity-95 disabled:opacity-50"
                >
                  {savingMemory ? 'Saving to Walrus…' : 'Pin to Walrus'}
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
