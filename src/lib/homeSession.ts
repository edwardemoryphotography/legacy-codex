import { QUESTION_LIMIT, type HomeTool } from './homeRequest'
import type { ConversationTier } from './modelPreference'
export type LiveEntry = { question: string; text: string; provider: string; actionTitle: string | null; finishWhen: string | null; saved?: boolean; /** A live answer with no completion boundary is retained honestly as partial. */ partial?: boolean; source?: 'delegated' | 'direct' }
export const LIVE_ENTRY_LIMIT = 40
export type HomeAttachmentMeta = { name: string; size: number; note?: string | null }
export type HomeReply = {
  question: string
  text: string
  label: string
  provider: string
  actionTitle?: string | null
  attachments?: HomeAttachmentMeta[]
  selectionRationale?: string | null
  processingDisclosure?: string | null
}

/** Separates concise modal/card headings from expandable model-selection and
 *  file-processing disclosures (including legacy concatenated labels restored
 *  from sessionStorage). */
export function replyDisplayMeta(reply: HomeReply): {
  shortTitle: string
  isAttachment: boolean
  selectionRationale: string | null
  processingDisclosure: string | null
} {
  const hasAttachments = Boolean(reply.attachments && reply.attachments.length > 0)
  const rawLabel = (reply.label || '').trim()
  const looksLikeAttachment = hasAttachments || /^(Photo|Attachment) analysis\b/i.test(rawLabel)
  if (!looksLikeAttachment) {
    return {
      shortTitle: rawLabel || 'Full answer',
      isAttachment: false,
      selectionRationale: reply.selectionRationale ?? null,
      processingDisclosure: reply.processingDisclosure ?? null,
    }
  }
  const allImages = hasAttachments && reply.attachments!.every(item => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(item.name))
  const shortTitle = /^Photo analysis\b/i.test(rawLabel) || allImages ? 'Photo analysis' : 'Attachment analysis'
  let selectionRationale = reply.selectionRationale ?? null
  let processingDisclosure = reply.processingDisclosure ?? null
  // Gracefully unpack legacy multi-part labels saved in tab storage before this polish.
  if (!selectionRationale && !processingDisclosure && rawLabel.includes(' · ')) {
    const parts = rawLabel.split(' · ').slice(1).map(part => part.trim()).filter(Boolean)
    const filtered = parts.filter(part => !/^temporary files?\b/i.test(part))
    const disclosureIdx = filtered.findIndex(part => /processed once|stores only/i.test(part))
    if (disclosureIdx >= 0) {
      processingDisclosure = filtered.slice(disclosureIdx).join(' · ')
      const before = filtered.slice(0, disclosureIdx).join(' · ')
      if (before) selectionRationale = before
    } else if (filtered.length > 0) {
      selectionRationale = filtered.join(' · ')
    }
  }
  return { shortTitle, isAttachment: true, selectionRationale, processingDisclosure }
}
/** Account-scoped dialogue for this browser tab; never a saved action or lesson. */
export type HomeSession = { accountId: string | null; text: string; tool: HomeTool | null; history: HomeReply[]; reply: HomeReply | null; tier?: ConversationTier; liveEntries?: LiveEntry[] }
export function emptyHomeSession(accountId: string | null = null): HomeSession {
  return { accountId, text: '', tool: null, history: [], reply: null, liveEntries: [] }
}

export function recentConversation(session: HomeSession) {
  return [...session.history, ...(session.reply ? [session.reply] : [])]
    .filter(reply => reply.question.trim() && reply.text.trim()).slice(-6)
    .flatMap(reply => {
      const attachmentPrefix = reply.attachments && reply.attachments.length > 0
        ? `[Temporary attachment analysis of ${reply.attachments.map(a => a.name).join(', ')}; original file(s) were not stored and are not re-read in follow-up turns]\n`
        : ''
      return [
        { role: 'user' as const, text: reply.question.slice(0, 4000) },
        { role: 'assistant' as const, text: `${attachmentPrefix}${reply.text}`.slice(0, 4000) },
      ]
    })
}

export function restoreHomeSession(accountId: string): HomeSession {
  try {
    const raw = sessionStorage.getItem(`codex-conversation:${accountId}`)
    if (!raw || raw.length > 1_000_000) return emptyHomeSession(accountId)
    const value = JSON.parse(raw)
    const attachmentMeta = (entry: unknown): entry is HomeAttachmentMeta => Boolean(
      entry && typeof entry === 'object' &&
      typeof (entry as { name?: unknown }).name === 'string' && (entry as { name: string }).name.length <= 400 &&
      typeof (entry as { size?: unknown }).size === 'number' && Number.isFinite((entry as { size: number }).size) && (entry as { size: number }).size >= 0 &&
      ((entry as { note?: unknown }).note === undefined || (entry as { note?: unknown }).note === null || (typeof (entry as { note?: unknown }).note === 'string' && (entry as { note: string }).note.length <= 240))
    )
    const reply = (item: unknown): item is HomeReply => Boolean(item && typeof item === 'object' &&
      ['question', 'text', 'label', 'provider'].every(key => typeof (item as Record<string, unknown>)[key] === 'string' && ((item as Record<string, string>)[key].length <= 100_000)) &&
      ((item as { actionTitle?: unknown }).actionTitle === undefined || (item as { actionTitle?: unknown }).actionTitle === null || (typeof (item as { actionTitle?: unknown }).actionTitle === 'string' && (item as { actionTitle: string }).actionTitle.length <= 240)) &&
      ((item as { selectionRationale?: unknown }).selectionRationale === undefined || (item as { selectionRationale?: unknown }).selectionRationale === null || (typeof (item as { selectionRationale?: unknown }).selectionRationale === 'string' && (item as { selectionRationale: string }).selectionRationale.length <= 1_000)) &&
      ((item as { processingDisclosure?: unknown }).processingDisclosure === undefined || (item as { processingDisclosure?: unknown }).processingDisclosure === null || (typeof (item as { processingDisclosure?: unknown }).processingDisclosure === 'string' && (item as { processingDisclosure: string }).processingDisclosure.length <= 1_000)) &&
      ((item as { attachments?: unknown }).attachments === undefined || (Array.isArray((item as { attachments?: unknown }).attachments) && (item as { attachments: unknown[] }).attachments.length <= 8 && (item as { attachments: unknown[] }).attachments.every(attachmentMeta))))
    if (value.accountId !== accountId || typeof value.text !== 'string' || value.text.length > QUESTION_LIMIT ||
        ![null, 'brief', 'triage', 'ask', 'prompt'].includes(value.tool) || !Array.isArray(value.history) || value.history.length > 6 ||
        !value.history.every(reply) || (value.reply !== null && !reply(value.reply))) return emptyHomeSession(accountId)
    const liveEntry = (item: unknown): item is LiveEntry => {
      if (!item || typeof item !== 'object') return false
      const entry = item as Partial<LiveEntry>
      return typeof entry.question === 'string' && entry.question.length <= 4_000 &&
        typeof entry.text === 'string' && entry.text.length <= 8_000 &&
        typeof entry.provider === 'string' && entry.provider.length <= 120 &&
        (entry.actionTitle === null || (typeof entry.actionTitle === 'string' && entry.actionTitle.length <= 240)) &&
        (entry.finishWhen === null || (typeof entry.finishWhen === 'string' && entry.finishWhen.length <= 300)) &&
        (entry.saved === undefined || typeof entry.saved === 'boolean') &&
        (entry.partial === undefined || typeof entry.partial === 'boolean') &&
        (entry.source === undefined || entry.source === 'delegated' || entry.source === 'direct')
    }
    const liveEntries = Array.isArray(value.liveEntries) && value.liveEntries.length <= LIVE_ENTRY_LIMIT && value.liveEntries.every(liveEntry)
      ? value.liveEntries as LiveEntry[] : []
    return { accountId, text: value.text, tool: value.tool, history: value.history, reply: value.reply, liveEntries }
  } catch { return emptyHomeSession(accountId) }
}
export function preserveHomeSession(session: HomeSession) {
  if (!session.accountId) return
  try { sessionStorage.setItem(`codex-conversation:${session.accountId}`, JSON.stringify({ ...session, history: session.history.slice(-6), liveEntries: (session.liveEntries ?? []).slice(-LIVE_ENTRY_LIMIT) })) } catch { /* Keep in-memory continuity when storage is unavailable. */ }
}
