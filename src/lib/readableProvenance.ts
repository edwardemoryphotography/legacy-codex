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
    // The token is not one of the supplied sources. Never render it as if it
    // were a legitimate supplied source; say that it is unverified.
    return 'an unverified source reference'
  })

  if (byUuid.size > 0) {
    out = out.replace(BARE_UUID_RE, uuid => {
      const match = byUuid.get(uuid.toLowerCase())
      return match ? `“${shortLabel(match)}”` : 'an unverified reference'
    })
  }

  // Clean up redundant empty citation wrappers like "(“Ship store”)" -> "(Ship store)"
  // or doubled spaces left by parenthetical ID lists, without altering meaning.
  return out.replace(/\s{2,}/g, ' ').trim()
}

export interface ReviewProvenanceSummary {
  tierLabel: string | null
  passLabel: string | null
  /** The user's explicit choice (or the Economy default), not a routing claim. */
  selectionBasis: string | null
  /** Static measured policy vs unknown for older records. Never "learned". */
  policyLabel: string | null
  intelligenceLabel: string | null
  fallbackLabel: string | null
  participantsLabel: string | null
  elapsedLabel: string | null
  elapsedBasisLabel: string | null
  executionUnknown: boolean
  citedLessonNote: string | null
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
    ? 'User selected Deep'
    : review.tier === 'routine'
      ? 'Economy default'
      : null
  const execution = review.execution
  const providerName = execution ? PROVIDER_LABELS[execution.provider]
    : review.provider ? PROVIDER_LABELS[review.provider] : null
  const modelName = execution?.model ?? review.model ?? null
  const intelligenceLabel = providerName && modelName
    ? `${providerName} · ${modelName}`
    : providerName ?? modelName ?? null
  const policyLabel = execution
    ? 'Static measured selection — not learned routing'
    : review.tier ? 'Selection policy not recorded for this older review' : null
  const fallbackLabel = execution
    ? execution.fallbacks.length
      ? `Fallback used: ${execution.fallbacks.map(item => `${PROVIDER_LABELS[item.provider]}${item.skipped ? ' skipped' : ` (${item.reason})`}`).join(' → ')}`
      : 'No fallback used'
    : null
  const participant = (value: { provider: NonNullable<ProjectReview['provider']>; model: string } | null) =>
    value ? `${PROVIDER_LABELS[value.provider]} · ${value.model}` : null
  const participantsLabel = execution?.critique
    ? `Draft: ${participant(execution.draft) ?? 'not recorded'} · Critique: ${participant(execution.critique)}`
    : null
  const measuredMs = execution?.elapsedMs ?? review.elapsedMs
  const elapsedLabel = typeof measuredMs === 'number' && Number.isFinite(measuredMs) && measuredMs >= 0
    ? measuredMs >= 1_000 ? `${(measuredMs / 1_000).toFixed(1)}s` : `${Math.round(measuredMs)}ms`
    : null
  const elapsedBasisLabel = elapsedLabel
    ? execution ? 'after context assembly, to review built' : 'recorded duration'
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
    policyLabel,
    intelligenceLabel,
    fallbackLabel,
    participantsLabel,
    elapsedLabel,
    elapsedBasisLabel,
    executionUnknown: !execution,
    citedLessonNote: citedLessons.length ? 'Lessons cited as context; influence not demonstrated' : null,
    sourcesSummary,
    citedSources,
    citedLessons,
    cached: review.cached,
    reviewedAt: review.reviewedAt,
  }
}
