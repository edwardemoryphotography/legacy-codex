import { parseProjectReview, type ProjectReview } from './projectReview'
import type { loadProjectContext, projectUserClient } from './projectReviewServer'

export async function cachedProjectReview(client: ReturnType<typeof projectUserClient>, userId: string, context: Awaited<ReturnType<typeof loadProjectContext>>): Promise<ProjectReview | null> {
  const cached = await client.from('mission_events').select('detail').eq('user_id', userId).eq('mission_id', context.mission.id).eq('type', 'delta_reviewed').order('created_at', { ascending: false }).limit(1)
  if (cached.error) throw new Error('Could not read the previous review.')
  if (!cached.data?.[0]) return null
  try {
    const previous = JSON.parse(cached.data[0].detail) as ProjectReview
    const valid = parseProjectReview(JSON.stringify(previous), context.sources, context.mission.id)
    const age = Date.now() - Date.parse(previous.reviewedAt)
    if (previous.missionId !== context.mission.id || previous.finishLine !== context.mission.finish_line || previous.contextKey !== context.contextKey || !valid || !Number.isFinite(age) || age < 0 || age > 3_600_000) return null
    return { ...previous, ...valid, sources: context.sources, warnings: context.warnings, cached: true }
  } catch { return null }
}

export function projectIsReviewable(context: Awaited<ReturnType<typeof loadProjectContext>>): boolean {
  return ['primary', 'secondary'].includes(context.mission.state) &&
    Boolean(context.mission.finish_line) && !context.mission.blocker && !context.mission.capacity_mismatch &&
    !context.hasEvidenceConflict
}
