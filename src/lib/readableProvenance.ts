import type { ProjectReview, ProjectSource } from './projectReview'

/**
 * Presentation-only helpers that keep human recommendation prose free of raw
 * technical IDs (mission:<uuid>, action:<uuid>, etc.) while preserving exact
 * underlying identifiers for expandable provenance inspection.
 *
 * Never invents labels, provenance, or execution facts.
 */

const KIND_LABELS: Record<ProjectSource['kind'], string> = {
  mission: 'Mission',
  commitment: 'Saved step',
  evidence: 'Evidence',
  human_note: 'Your note',
  correction: 'Correction',
  lesson: 'Confirmed lesson',
  repository: 'Repository file',
  model_draft: 'Earlier draft',
}

const PROVIDER_LABELS: Record<NonNullable<ProjectReview['provider']>, string> = {
  anthropic: 'Claude',
  gemini: 'Gemini',
  openai: 'OpenAI',
}

export function sourceKindLabel(kind: ProjectSource['kind']): string {
  return KIND_LABELS[kind] ?? 'Source'
}

function shortLabel(source: ProjectSource): string {
  const clean = source.label.trim()
  if (!clean) return sourceKindLabel(source.kind)
  return clean.length > 72 ? `${clean.slice(0, 69).trimEnd()}…` : clean
}

// Matches structured source tokens like `mission:<uuid>`, `action:<uuid>`,
// `event:<uuid>`, `evidence:<id>`, `lesson:<uuid>`, or `repository:owner/repo/...`
const SOURCE_TOKEN_RE = /\b(?:mission|action|event|evidence|lesson|repository):[A-Za-z0-9._/@:-]{6,}\b/g
const BARE_UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

/**
 * Replaces raw source IDs inside model-written prose with readable source
 * labels from `sources`. Underlying source IDs remain untouched on the review
 * object and are still rendered inside expandable provenance chips.
 */
export function humanizeSourceText(text: string, sources?: readonly ProjectSource[]): string {
  if (!text) return text
  const byId = new Map<string, ProjectSource>()
  const byUuid = new Map<string, ProjectSource>()
  for (const source of sources ?? []) {
    byId.set(source.id, source)
    const colon = source.id.indexOf(':')
    if (colon > 0) byUuid.set(source.id.slice(colon + 1).toLowerCase(), source)
  }

  let out = text.replace(SOURCE_TOKEN_RE, token => {
    const match = byId.get(token)
    if (match) return `“${shortLabel(match)}”`
    const kind = token.slice(0, token.indexOf(':'))
    if (kind === 'mission') return 'this mission'
    if (kind === 'action') return 'your saved step'
    if (kind === 'lesson') return 'a confirmed lesson'
    if (kind === 'evidence') return 'recorded evidence'
    if (kind === 'event') return 'your saved note'
    if (kind === 'repository') return 'linked repository file'
    return 'saved source'
  })

  if (byUuid.size > 0) {
    out = out.replace(BARE_UUID_RE, uuid => {
      const match = byUuid.get(uuid.toLowerCase())
      return match ? `“${shortLabel(match)}”` : uuid
    })
  }

  // Clean up redundant empty citation wrappers like "(“Ship store”)" -> "(Ship store)"
  // or doubled spaces left by parenthetical ID lists, without altering meaning.
  return out.replace(/\s{2,}/g, ' ').trim()
}

export interface ReviewProvenanceSummary {
  tierLabel: string | null
  passLabel: string | null
  selectionBasis: string | null
  intelligenceLabel: string | null
  elapsedLabel: string | null
  sourcesSummary: string
  citedSources: ProjectSource[]
  citedLessons: ProjectSource[]
  cached: boolean
  reviewedAt: string
}

/**
 * Extracts only the provenance facts actually recorded on a ProjectReview.
 * Never claims an independent critique occurred in single-pass Economy,
 * never claims learned adaptive routing when selection was an explicit tier
 * choice, and never invents a provider/model or duration when absent from an
 * older cached record.
 */
export function reviewProvenanceSummary(review: ProjectReview): ReviewProvenanceSummary {
  const tierLabel = review.tier === 'deep' ? 'Deep' : review.tier === 'routine' ? 'Economy' : null
  const passLabel = review.critique === 'single_pass'
    ? 'Single structured pass'
    : review.critique === 'independent'
      ? 'Draft + independent critique'
      : null
  const selectionBasis = review.tier === 'deep'
    ? 'Selected by Deep mode'
    : review.tier === 'routine'
      ? 'Selected by Economy default'
      : null
  const providerName = review.provider ? PROVIDER_LABELS[review.provider] : null
  const intelligenceLabel = providerName && review.model
    ? `${providerName} · ${review.model}`
    : providerName ?? review.model ?? null
  const elapsedLabel = typeof review.elapsedMs === 'number' && Number.isFinite(review.elapsedMs) && review.elapsedMs >= 0
    ? review.elapsedMs >= 1_000 ? `${(review.elapsedMs / 1_000).toFixed(1)}s` : `${Math.round(review.elapsedMs)}ms`
    : null

  const citedSet = new Set(review.sourceIds)
  const citedSources = review.sources.filter(source => citedSet.has(source.id))
  const citedLessons = citedSources.filter(source => source.kind === 'lesson')
  const sourcesSummary = review.sources.length > 0
    ? `${citedSources.length} of ${review.sources.length} supplied source${review.sources.length === 1 ? '' : 's'} cited`
    : `${review.sourceIds.length} source${review.sourceIds.length === 1 ? '' : 's'} cited`

  return {
    tierLabel,
    passLabel,
    selectionBasis,
    intelligenceLabel,
    elapsedLabel,
    sourcesSummary,
    citedSources,
    citedLessons,
    cached: review.cached,
    reviewedAt: review.reviewedAt,
  }
}
