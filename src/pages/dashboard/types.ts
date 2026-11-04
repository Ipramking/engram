export type Scope = 'personal' | 'team'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scope: Scope
  room: string
  team_id?: string | null
  is_active?: boolean
  created_at: string
  last_used_at?: string | null
  /** 30-day signed connection token, re-issued every time the key list is fetched. */
  liveKey?: string
  connectorUrl: string
}

export interface Team {
  id: string
  name: string
  created_at: string
  plan_tier?: string
}

export interface TeamMember {
  id: string
  user_id: string
  email: string
  role: string
  created_at: string
}

export interface QuotaBlock {
  saves: number
  dailyLimit: number
  remaining?: number
  percentUsed?: number
  recalls: number
  resetAt?: number
  secondsUntilReset?: number
}

export interface UsageData {
  plan: string
  personal: QuotaBlock & { maxMemories: number }
  teams: Array<QuotaBlock & { teamId: string; teamName: string; plan: string; maxMembers: number }>
}

export interface Memory {
  id: string
  type: string
  text: string
  blobId?: string | null
  createdAt?: string
  isSuperseded?: boolean
  supersededBy?: string | null
}

export interface MemoryStats {
  total: number
  active: number
  superseded: number
}

export type TabId = 'home' | 'connect' | 'memories' | 'keys' | 'teams' | 'usage' | 'guide'

/** A key the user can connect with: its long-lived secret (only right after creation) or its 30-day link token. */
export interface ActiveCredential {
  key: ApiKey
  token: string
  url: string
  permanent: boolean
  expiresAt: Date | null
}
