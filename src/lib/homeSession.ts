import type { HomeTool } from './homeRequest'
export type HomeReply = { question: string; text: string; label: string; provider: string }
/** Memory only, scoped to the current account. Never a saved action or lesson. */
export type HomeSession = { accountId: string | null; text: string; tool: HomeTool | null; history: HomeReply[]; reply: HomeReply | null }
export function emptyHomeSession(accountId: string | null = null): HomeSession {
  return { accountId, text: '', tool: null, history: [], reply: null }
}
