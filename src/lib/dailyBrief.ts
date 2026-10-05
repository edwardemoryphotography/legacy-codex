// Shared between the client (BriefTab) and the server (/api/brief): the only
// place a real Mission is narrowed to what the Daily Brief prompt is allowed
// to see, and the only place that prompt's directive text is assembled. The
// server owns calling buildBriefDirective — a client can send missions, but
// never substitute its own directive for the one the system prompt expects.
import type { Mission } from '@/types'

export type BriefMode = 'daily_brief' | 'triage' | 'question'

export interface BriefMissionContext {
  missionId?: string
  title: string
  state: Mission['state']
  why: string
  finishLine: string | null
  blocker: string | null
  capacityMismatch: boolean
}

const MAX_MISSIONS = 40
// Also the server-side clamp in /api/brief for every text field.
export const MAX_FIELD_LENGTH = 400

function clip(value: string | null | undefined, max = MAX_FIELD_LENGTH): string | null {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max)}…` : value
}

// IDs are attached separately by the server after explicit scope validation.
// Keeping the client payload to these fields keeps the trust surface
// explicit (see /api/brief's own re-validation of this same shape).
export function missionToBriefContext(mission: Mission): BriefMissionContext {
  return {
    title: clip(mission.title) ?? '',
    state: mission.state,
    why: clip(mission.why) ?? '',
    finishLine: clip(mission.finishLine),
    blocker: clip(mission.blocker),
    capacityMismatch: mission.capacityMismatch,
  }
}

export function missionsToBriefContext(missions: Mission[]): BriefMissionContext[] {
  return missions.slice(0, MAX_MISSIONS).map(missionToBriefContext)
}

// "Stalled" for this feature only: a mission that cannot move without a
// human decision right now. Mirrors missionLoop's own blocked/capacity-
// mismatch vocabulary; this does not redefine Strategic Delta's situation
// model and nothing here feeds back into it.
export function stalledMissions(missions: BriefMissionContext[]): BriefMissionContext[] {
  return missions.filter(m => m.state === 'blocked' || m.capacityMismatch)
}

function describeMission(m: BriefMissionContext): string {
  const bits = [`${m.missionId ? `[project ${m.missionId}] ` : ''}"${m.title}" (${m.state}${m.capacityMismatch ? ', capacity mismatch' : ''})`]
  if (m.why) bits.push(`why: ${m.why}`)
  if (m.finishLine) bits.push(`finish line: ${m.finishLine}`)
  if (m.blocker) bits.push(`blocker: ${m.blocker}`)
  return bits.join(' — ')
}

// Pure and exported so it is testable without a network call or a server
// route — see dailyBrief.test.ts. Given the same missions and mode, this
// always produces the same directive text.
export function buildBriefDirective(mode: BriefMode, missions: BriefMissionContext[], question?: string): string {
  if (missions.length === 0) {
    return 'No missions exist yet for this account. Say plainly that there is nothing to brief until a mission is added — do not invent one.'
  }

  const roster = missions.map(describeMission).join('\n')

  if (mode === 'triage') {
    const stalled = stalledMissions(missions)
    if (stalled.length === 0) {
      return `Missions:\n${roster}\n\nNone of these are blocked or capacity-mismatched right now. Say so in one line; do not invent a problem to solve.`
    }
    const stalledRoster = stalled.map(describeMission).join('\n')
    return `All missions:\n${roster}\n\nBlocked or capacity-mismatched right now:\n${stalledRoster}\n\nFor each one listed as blocked or capacity-mismatched: name one concrete, physical next action that would actually test or clear it. Ground every suggestion in the blocker or why text given — never invent a blocker that was not stated.`
  }

  if (mode === 'question') {
    const q = (question ?? '').trim() || 'What matters most right now?'
    return `Missions:\n${roster}\n\nQuestion: ${q}`
  }

  return `Missions:\n${roster}\n\nGive the 3 highest-leverage moves across these missions right now, grounded only in the state, why, finish line, and blocker text given above.`
}
