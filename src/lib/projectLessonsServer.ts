import type { projectUserClient } from './projectReviewServer'
import { parseLessonProposal, type ConfirmedLesson } from './projectReview'

type Client = ReturnType<typeof projectUserClient>

// These are human-confirmed operating rules, never verified evidence. The
// append-only transitional mission ledger owns this slice, not new doctrine.
export async function loadConfirmedLessons(client: Client, userId: string, missionIds: string[]): Promise<ConfirmedLesson[]> {
  const lessons: ConfirmedLesson[] = []
  const PAGE_SIZE = 100
  // Bound new inserts while paging; stable tie ordering prevents equal-time
  // confirmations from falling through a page boundary.
  const through = new Date().toISOString()
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const confirmed = await client.from('mission_events').select('id,mission_id,detail,created_at')
      .eq('user_id', userId).eq('type', 'delta_lesson_confirmed').lte('created_at', through)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (confirmed.error) throw new Error('Could not read confirmed lessons.')
    const rows = confirmed.data ?? []
    if (!rows.length) break
    const retired = await client.from('mission_events').select('idempotency_key').eq('user_id', userId)
      .eq('type', 'delta_lesson_retired').in('idempotency_key', rows.map(row => `lesson:retire:${row.id}`))
    if (retired.error) throw new Error('Could not read lesson retirements.')
    const inactive = new Set((retired.data ?? []).map(row => row.idempotency_key))
    for (const row of rows.filter(row => !inactive.has(`lesson:retire:${row.id}`))) {
      // A malformed stored rule must not silently become 'no prior learning'.
      const saved = JSON.parse(row.detail) as ConfirmedLesson
      if (!Array.isArray(saved.sourceRefs) || !saved.sourceRefs.every(ref =>
        typeof ref.id === 'string' && typeof ref.label === 'string' && typeof ref.status === 'string') ||
        !['mission', 'account'].includes(saved.scope) || !Number.isFinite(Date.parse(saved.reviewedAt))) {
        throw new Error('A confirmed lesson could not be reconstructed.')
      }
      const proposal = parseLessonProposal(saved, saved.sourceRefs)
      if (!proposal) throw new Error('A confirmed lesson has invalid provenance.')
      if (saved.scope === 'account' || missionIds.includes(row.mission_id)) {
        lessons.push({ ...proposal, id: row.id, missionId: row.mission_id, scope: saved.scope,
          reviewedAt: saved.reviewedAt, confirmedAt: row.created_at, sourceRefs: saved.sourceRefs })
        if (lessons.length === 16) return lessons
      }
    }
    if (rows.length < PAGE_SIZE) break
  }
  return lessons
}
