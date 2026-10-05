import { projectUserClient } from './projectReviewServer'
import { loadConfirmedLessons } from './projectLessonsServer'
import { formatLearnedContext } from './learnedContext'

export const MISSION_UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// Uses only the caller's JWT/RLS. Without an explicit project ID, account
// rules alone apply. Never infer scope from a title or a client-supplied rule.
export async function loadLearnedContext(url: string, authorization: string, userId: string, missionIds: string[] = []) {
  if (missionIds.length > 40 || missionIds.some(id => typeof id !== 'string' || !MISSION_UUID.test(id))) throw new Error('Invalid lesson scope.')
  const client = projectUserClient(url, authorization)
  const ids = [...new Set(missionIds)]
  if (ids.length) {
    const owned = await client.from('missions').select('id').eq('user_id', userId).in('id', ids)
    if (owned.error || owned.data?.length !== ids.length) throw new Error('Lesson project scope could not be verified.')
  }
  const lessons = await loadConfirmedLessons(client, userId, ids)
  return formatLearnedContext(lessons, ids)
}
