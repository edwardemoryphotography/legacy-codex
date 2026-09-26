import type { Mission, MissionState, SavedAction } from '@/types'

// Missions the front door resumes from, best first. Completed and abandoned
// missions are left out: an unfinished action there stays in Resumption Log,
// but it is not "where you left off" on Mission.
const FRONT_DOOR_ORDER: Partial<Record<MissionState, number>> = {
  primary: 0,
  secondary: 1,
  blocked: 2,
  paused: 3,
  parked: 4,
  candidate: 5,
}

/** Unfinished saved actions the Mission screen can offer to resume, best
 *  first: Primary, then Secondary, then other live missions, newest within
 *  each. Mission title and state come from the board when it has the
 *  mission, since it is fresher than the join on the action row. */
export function resumableActions(
  actions: SavedAction[],
  missions: Readonly<Record<string, Pick<Mission, 'title' | 'state'>>>,
): SavedAction[] {
  return actions
    .filter(action => action.status !== 'DONE')
    .map(action => {
      const mission = missions[action.mission_id]
      return {
        ...action,
        mission: mission ? { title: mission.title, state: mission.state } : action.mission,
      }
    })
    .filter(action => FRONT_DOOR_ORDER[action.mission.state as MissionState] !== undefined)
    .sort((a, b) => {
      const byMission = FRONT_DOOR_ORDER[a.mission.state as MissionState]! - FRONT_DOOR_ORDER[b.mission.state as MissionState]!
      return byMission || Date.parse(b.updated_at) - Date.parse(a.updated_at)
    })
}

/** TODO with a note is an action someone started and set down ("Save &
 *  pause" requires a note); TODO without one has not been started. */
export function actionStatusLabel(action: Pick<SavedAction, 'status' | 'resume_note'>): string {
  if (action.status === 'IN_PROGRESS') return 'In progress'
  if (action.status === 'DONE') return 'Marked done'
  return action.resume_note?.trim() ? 'Paused' : 'Not started yet'
}

export function savedAgo(updatedAt: string, now: number): string {
  const then = Date.parse(updatedAt)
  if (!Number.isFinite(then)) return ''
  const minutes = Math.floor((now - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return `on ${new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}
