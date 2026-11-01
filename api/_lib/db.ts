export {
  PLAN_LIMITS,
  hashKey,
  generateApiKey,
  getTodayStr,
  getProfile,
  createProfile,
  createApiKey,
  listApiKeys,
  validateApiKey,
  revokeApiKey,
  createTeam,
  listTeams,
  listTeamMembers,
  isTeamMember,
  addTeamMember,
  getUsage,
  checkAndIncrementUsage,
  getQuotaResetMetadata,
} from '../../mcp/auth-db.mjs'

export interface PlanLimits {
  dailySaves: number
  maxTeamMembers: number
  maxRooms: number
  maxMemories: number
}
