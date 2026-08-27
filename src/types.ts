export type Scope = 'personal' | 'team'

export type Memory = {
  type: string
  text: string
  blobId?: string
}

export type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  recalled?: Memory[]
  remembered?: Memory[]
  pending?: boolean
}
