import { QUESTION_LIMIT, type HomeTool } from './homeRequest'
import type { ConversationTier } from './modelPreference'
export type HomeReply = { question: string; text: string; label: string; provider: string; actionTitle?: string | null }
/** Account-scoped dialogue for this browser tab; never a saved action or lesson. */
export type HomeSession = { accountId: string | null; text: string; tool: HomeTool | null; history: HomeReply[]; reply: HomeReply | null; tier?: ConversationTier }
export function emptyHomeSession(accountId: string | null = null): HomeSession {
  return { accountId, text: '', tool: null, history: [], reply: null }
}

export function recentConversation(session: HomeSession) {
  return [...session.history, ...(session.reply ? [session.reply] : [])]
    .filter(reply => reply.question.trim() && reply.text.trim()).slice(-6)
    .flatMap(reply => [{ role: 'user' as const, text: reply.question.slice(0, 4000) }, { role: 'assistant' as const, text: reply.text.slice(0, 4000) }])
}

export function restoreHomeSession(accountId: string): HomeSession {
  try {
    const raw = sessionStorage.getItem(`codex-conversation:${accountId}`)
    if (!raw || raw.length > 1_000_000) return emptyHomeSession(accountId)
    const value = JSON.parse(raw)
    const reply = (item: unknown): item is HomeReply => Boolean(item && typeof item === 'object' &&
      ['question', 'text', 'label', 'provider'].every(key => typeof (item as Record<string, unknown>)[key] === 'string' && ((item as Record<string, string>)[key].length <= 100_000)) &&
      ((item as { actionTitle?: unknown }).actionTitle === undefined || (item as { actionTitle?: unknown }).actionTitle === null || (typeof (item as { actionTitle?: unknown }).actionTitle === 'string' && (item as { actionTitle: string }).actionTitle.length <= 240)))
    if (value.accountId !== accountId || typeof value.text !== 'string' || value.text.length > QUESTION_LIMIT ||
        ![null, 'brief', 'triage', 'ask', 'prompt'].includes(value.tool) || !Array.isArray(value.history) || value.history.length > 6 ||
        !value.history.every(reply) || (value.reply !== null && !reply(value.reply))) return emptyHomeSession(accountId)
    return { accountId, text: value.text, tool: value.tool, history: value.history, reply: value.reply }
  } catch { return emptyHomeSession(accountId) }
}
export function preserveHomeSession(session: HomeSession) {
  if (!session.accountId) return
  try { sessionStorage.setItem(`codex-conversation:${session.accountId}`, JSON.stringify({ ...session, history: session.history.slice(-6) })) } catch { /* Keep in-memory continuity when storage is unavailable. */ }
}
