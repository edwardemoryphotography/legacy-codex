// Shared transport and validation; all conclusions remain model proposals.
export interface ProjectSource {
  id: string
  label: string
  kind: 'mission' | 'evidence' | 'commitment' | 'human_note' | 'correction' | 'repository' | 'lesson'
  status: string
  text: string
  url?: string
  truncated?: boolean
  // Set from an authenticated canonical action row, never from model text.
  commitment?: { id: string; missionId: string; status: string; actionTitle?: string }
}

export interface ReviewAlternative {
  operation: string
  whyNot: string
  sourceIds: string[]
}

export interface LessonProposal {
  rule: string
  whenToApply: string
  sourceIds: string[]
}

export interface ConfirmedLesson extends LessonProposal {
  id: string
  missionId: string
  scope: 'mission' | 'account'
  confirmedAt: string
  reviewedAt: string
  sourceRefs: Pick<ProjectSource, 'id' | 'label' | 'status' | 'url'>[]
}

export interface LessonConfirmation {
  missionId: string
  contextKey: string
  rule: string
  whenToApply: string
  scope: 'mission' | 'account'
}

export interface ProjectReview {
  missionId: string
  finishLine: string
  operation: string | null
  decision: 'act' | 'resume' | 'clarify'
  finishWhen: string | null
  clarification: string | null
  resumeActionId: string | null
  alternatives: ReviewAlternative[]
  biggerPicture: string
  why: string
  overlooked: string
  selfCheck: string
  unknowns: string[]
  sourceIds: string[]
  sources: ProjectSource[]
  contextKey: string
  reviewedAt: string
  cached: boolean
  warnings: string[]
  lesson: LessonProposal | null
}

export interface ProjectReviewRequest {
  missionId: string
  finishLine: string
}

export function boundSourceText(text: string, maxChars = 6_000): { text: string; truncated: boolean } {
  return { text: text.slice(0, maxChars), truncated: text.length > maxChars }
}

export function githubFileReference(value: string): { owner: string; repository: string; ref: string; path: string } | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search) return null
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const [owner, repository, mode, ref, ...file] = parts
    if (mode !== 'blob' || !/^[\w.-]+$/.test(owner ?? '') || !/^[\w.-]+$/.test(repository ?? '') || !/^[\w.-]+$/.test(ref ?? '') || [owner, repository, ref].some(p => p === '.' || p === '..')) return null
    if (!file.length || file.some(p => !p || p === '.' || p === '..' || p.includes('/') || p.includes('\\'))) return null
    const path = file.join('/')
    if (!/\.(md|txt|json|csv|ts|tsx|js|jsx|py|sql|yml|yaml|html|css)$/i.test(path)) return null
    return { owner, repository, ref, path }
  } catch { return null }
}

export function sourceLinks(text: string): string[] {
  const links = text.match(/https:\/\/github\.com\/[^\s<>"']+/g) ?? []
  return [...new Set(links.map(link => link.replace(/[),.;]+$/, '').replace(/#.*$/, '')).filter(link => githubFileReference(link)))].slice(0, 2)
}

export function parseLessonProposal(value: unknown, sources: Pick<ProjectSource, 'id'>[]): LessonProposal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  if (typeof row.rule !== 'string' || !row.rule.trim() || row.rule.length > 1_000 ||
      typeof row.whenToApply !== 'string' || !row.whenToApply.trim() || row.whenToApply.length > 500) return null
  const available = new Set(sources.map(s => s.id))
  if (!Array.isArray(row.sourceIds) || !row.sourceIds.length || row.sourceIds.length > 12 ||
      !row.sourceIds.every(id => typeof id === 'string' && available.has(id))) return null
  return { rule: row.rule.trim(), whenToApply: row.whenToApply.trim(), sourceIds: [...new Set(row.sourceIds as string[])] }
}

const COMMON_WORDS = new Set('about after again also before could current done every from have into just legacy codex mission more next other project review same should still system that their them then there these they this through using want what when where which with work would your'.split(' '))

export function contextTerms(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(term => !COMMON_WORDS.has(term)))].slice(0, 120)
}

export function relatedProjectSignal(targetText: string, candidate: { id: string; title: string; why?: string; finish_line?: string | null }): { score: number; reason: string } {
  if (targetText.includes(candidate.id)) return { score: 100, reason: 'Explicit project reference in the saved context.' }
  const terms = new Set(contextTerms(targetText))
  const shared = contextTerms(`${candidate.title} ${candidate.why ?? ''} ${candidate.finish_line ?? ''}`).filter(term => terms.has(term))
  return { score: shared.length, reason: shared.length ? `Shared context terms: ${shared.slice(0, 8).join(', ')}. Relationship is a hypothesis to check.` : 'No supported relationship signal.' }
}

export type ReviewProposal = Pick<ProjectReview, 'operation' | 'decision' | 'finishWhen' | 'clarification' | 'resumeActionId' | 'alternatives' | 'biggerPicture' | 'why' | 'overlooked' | 'selfCheck' | 'unknowns' | 'sourceIds' | 'lesson'>

export function parseProjectReview(raw: string, sources: ProjectSource[], missionId: string): ReviewProposal | null {
  try {
    const value: unknown = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const row = value as Record<string, unknown>
    const text = (key: string) => typeof row[key] === 'string' && (row[key] as string).trim() && (row[key] as string).length <= 1_000
    if (!['biggerPicture', 'why', 'overlooked', 'selfCheck'].every(text) || (row.why as string).length > 500) return null
    if (row.operation !== null && (typeof row.operation !== 'string' || !row.operation.trim() || row.operation.length > 240)) return null
    if (!Array.isArray(row.unknowns) || row.unknowns.length > 6 || !row.unknowns.every(x => typeof x === 'string' && x.length <= 500)) return null
    const available = new Set(sources.map(s => s.id))
    if (!Array.isArray(row.sourceIds) || !row.sourceIds.length || row.sourceIds.length > 12 || !row.sourceIds.every(id => typeof id === 'string' && available.has(id))) return null
    if (!row.sourceIds.includes(`mission:${missionId}`)) return null
    const shortText = (value: unknown, limit: number) => typeof value === 'string' && Boolean(value.trim()) && value.length <= limit
    if (!['act', 'resume', 'clarify'].includes(row.decision as string)) return null
    if (row.decision === 'clarify') {
      if (row.operation !== null || row.finishWhen !== null || row.resumeActionId !== null || !shortText(row.clarification, 300)) return null
    } else if (!shortText(row.operation, 240) || !shortText(row.finishWhen, 300) || row.clarification !== null) return null
    if (row.decision === 'resume') {
      const action = sources.find(source => source.kind === 'commitment' && source.id === `action:${row.resumeActionId}`)
      if (!action?.commitment || action.commitment.id !== row.resumeActionId || action.commitment.missionId !== missionId ||
          !['TODO', 'IN_PROGRESS'].includes(action.commitment.status) || !row.sourceIds.includes(action.id)) return null
      // An authentic ID alone cannot authorize different work. Missing titles
      // (including older cached context) fail closed instead of relabeling it.
      if (typeof action.commitment.actionTitle !== 'string' || !shortText(action.commitment.actionTitle, 240) ||
          (row.operation as string).trim() !== action.commitment.actionTitle.trim()) return null
    } else if (row.resumeActionId !== null) return null
    if (!Array.isArray(row.alternatives) || row.alternatives.length > 2) return null
    const alternatives: ReviewAlternative[] = []
    for (const item of row.alternatives) {
      if (!item || typeof item !== 'object' || !shortText(item.operation, 240) || !shortText(item.whyNot, 500) ||
          !Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.length > 12 ||
          !item.sourceIds.every((id: unknown) => typeof id === 'string' && available.has(id))) return null
      const operation = item.operation.trim()
      if (operation.toLowerCase() === (row.operation as string | null)?.trim().toLowerCase() ||
          alternatives.some(alternative => alternative.operation.toLowerCase() === operation.toLowerCase())) return null
      alternatives.push({ operation, whyNot: item.whyNot.trim(), sourceIds: [...new Set(item.sourceIds as string[])] })
    }
    const lesson = row.lesson == null ? null : parseLessonProposal(row.lesson, sources)
    if (row.lesson != null && !lesson) return null
    return {
      operation: row.operation === null ? null : (row.operation as string).trim(),
      decision: row.decision as ReviewProposal['decision'],
      finishWhen: row.finishWhen === null ? null : (row.finishWhen as string).trim(),
      clarification: row.clarification === null ? null : (row.clarification as string).trim(),
      resumeActionId: row.resumeActionId as string | null, alternatives,
      biggerPicture: (row.biggerPicture as string).trim(), why: (row.why as string).trim(),
      overlooked: (row.overlooked as string).trim(), selfCheck: (row.selfCheck as string).trim(),
      unknowns: row.unknowns as string[], sourceIds: [...new Set(row.sourceIds as string[])],
      lesson,
    }
  } catch { return null }
}
