// Server-side security guardrails for Engram memories:
// 1. Secret scanner — blocks accidental storage of raw API keys, private keys, and tokens.
// 2. Prompt injection sanitizer — neutralizes control tags or instruction-override framing in recalled memories.

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'OpenAI / Anthropic / Groq API Key', regex: /\b(sk-[a-zA-Z0-9_-]{20,}|gsk_[a-zA-Z0-9_-]{20,})\b/ },
  { name: 'GitHub Personal Access Token', regex: /\b(ghp_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})\b/ },
  { name: 'Google Cloud / Firebase API Key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Sui / Walrus Private Key', regex: /\bsuiprivkey1[a-z0-9]{45,}\b/ },
  { name: 'PEM Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'Supabase Service Key / Raw JWT', regex: /\b(sbp_[a-zA-Z0-9]{30,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})\b/ },
  { name: 'Slack Token', regex: /\bxox[baprs]-[0-9a-zA-Z-]{15,}\b/ },
]

export function scanForSecrets(text: string): { hasSecret: boolean; reason?: string } {
  if (!text || typeof text !== 'string') return { hasSecret: false }
  for (const rule of SECRET_PATTERNS) {
    if (rule.regex.test(text)) {
      return {
        hasSecret: true,
        reason: `Security policy violation: detected a raw ${rule.name}. Never store raw secrets or private keys in memory; store their config location instead (e.g. "API key is stored in Vercel Environment Variables").`,
      }
    }
  }
  return { hasSecret: false }
}

export function sanitizeMemoryText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/gi, '')
    .replace(/<\/?(?:system|instruction|prompt|override)>/gi, '')
    .trim()
}
