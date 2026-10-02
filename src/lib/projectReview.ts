// Shared transport and validation; all conclusions remain model proposals.
export interface ProjectSource {
  id: string
  label: string
  kind: 'mission' | 'evidence' | 'commitment' | 'human_note' | 'correction' | 'repository' | 'lesson'
  status: string
  text: string
  url?: string
  truncated?: boolean
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

export function parseProjectReview(raw: string, sources: ProjectSource[]): Pick<ProjectReview, 'operation' | 'biggerPicture' | 'why' | 'overlooked' | 'selfCheck' | 'unknowns' | 'sourceIds' | 'lesson'> | null {
  try {
    const value: unknown = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const row = value as Record<string, unknown>
    const text = (key: string) => typeof row[key] === 'string' && (row[key] as string).trim() && (row[key] as string).length <= 1_000
    if (!['biggerPicture', 'why', 'overlooked', 'selfCheck'].every(text)) return null
    if (row.operation !== null && (typeof row.operation !== 'string' || !row.operation.trim() || row.operation.length > 240)) return null
    if (!Array.isArray(row.unknowns) || row.unknowns.length > 6 || !row.unknowns.every(x => typeof x === 'string' && x.length <= 500)) return null
    const available = new Set(sources.map(s => s.id))
    if (!Array.isArray(row.sourceIds) || !row.sourceIds.length || row.sourceIds.length > 12 || !row.sourceIds.every(id => typeof id === 'string' && available.has(id))) return null
    const lesson = row.lesson == null ? null : parseLessonProposal(row.lesson, sources)
    if (row.lesson != null && !lesson) return null
    return {
      operation: row.operation === null ? null : (row.operation as string).trim(),
      biggerPicture: (row.biggerPicture as string).trim(), why: (row.why as string).trim(),
      overlooked: (row.overlooked as string).trim(), selfCheck: (row.selfCheck as string).trim(),
      unknowns: row.unknowns as string[], sourceIds: [...new Set(row.sourceIds as string[])],
      lesson,
    }
  } catch { return null }
}
