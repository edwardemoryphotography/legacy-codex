import { parseProjectReview, type ProjectReview } from './projectReview'
import { unsupportedReviewAssertions } from './claimIntegrity'
import { measureTransfer } from './structuralTransfer'
import type { loadProjectContext, projectUserClient } from './projectReviewServer'

export async function cachedProjectReview(client: ReturnType<typeof projectUserClient>, userId: string, context: Awaited<ReturnType<typeof loadProjectContext>>, tier?: 'routine' | 'deep'): Promise<ProjectReview | null> {
  const cached = await client.from('mission_events').select('detail').eq('user_id', userId).eq('mission_id', context.mission.id).eq('type', 'delta_reviewed').order('created_at', { ascending: false }).limit(1)
  if (cached.error) throw new Error('Could not read the previous review.')
  if (!cached.data?.[0]) return null
  try {
    const previous = JSON.parse(cached.data[0].detail) as ProjectReview
    const valid = parseProjectReview(JSON.stringify(previous), context.sources, context.mission.id)
    const age = Date.now() - Date.parse(previous.reviewedAt)
    if (valid && unsupportedReviewAssertions(valid).length) return null
    if (previous.missionId !== context.mission.id || previous.finishLine !== context.mission.finish_line || previous.contextKey !== context.contextKey || !valid || !Number.isFinite(age) || age < 0 || age > 3_600_000) return null
    // Economy and Deep are different work products. Never let one restore as the other.
    if (tier && previous.tier && previous.tier !== tier) return null
    const candidateBaseline = previous.transferObservation?.baseline
      ? parseProjectReview(JSON.stringify(previous.transferObservation.baseline), context.sources.filter(source => source.kind !== 'lesson'), context.mission.id) : null
    const baseline = candidateBaseline && !unsupportedReviewAssertions(candidateBaseline).length ? candidateBaseline : null
    // Recompute the classification; never trust a stored/model-written claim of
    // inheritance. Old observations without intervention provenance are unknown.
    const transferObservation = measureTransfer({ baseline, after: valid, sources: context.sources, lessons: context.lessons,
      missionId: context.mission.id, requestContextAdded: previous.transferObservation?.interventionBasis?.requestContextAdded !== false, reviewedAt: previous.reviewedAt, interventionEvidence: context.interventionEvidence })
    // Keep the generated review's own excerpts and warnings; current context may
    // have moved on and must not rewrite what was actually shown.
    return { ...previous, ...valid, transferObservation,
      sources: previous.sources?.length ? previous.sources : context.sources,
      warnings: previous.warnings?.length ? previous.warnings : context.warnings, cached: true }
  } catch { return null }
}

export function projectIsReviewable(context: Awaited<ReturnType<typeof loadProjectContext>>): boolean {
  return ['primary', 'secondary'].includes(context.mission.state) &&
    Boolean(context.mission.finish_line) && !context.mission.blocker && !context.mission.capacity_mismatch &&
    !context.hasEvidenceConflict
}
