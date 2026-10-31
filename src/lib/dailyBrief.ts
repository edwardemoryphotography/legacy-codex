// Shared between the client (BriefTab) and the server (/api/brief): the only
// place a real Mission is narrowed to what the Daily Brief prompt is allowed
// to see, and the only place that prompt's directive text is assembled. The
// server owns calling buildBriefDirective — a client can send missions, but
// never substitute its own directive for the one the system prompt expects.
import type { Mission } from '@/types'

export type BriefMode = 'daily_brief' | 'triage' | 'question' | 'architect' | 'unblock'

// Architect Scan and Break Wall look at exactly one mission. The client sends
// that mission alone (plus its id), and this target says what to look at.
export type BriefTargetKind = 'mission' | 'blocker' | 'action'

export interface BriefActionContext {
  title: string
  status: string
  resumeNote: string | null
}

export interface BriefTarget {
  kind: BriefTargetKind
  evidenceRequirement: string | null
  // The mission's one unfinished saved action (actions.status <> 'DONE'), if any.
  action: BriefActionContext | null
}

export const SINGLE_MISSION_MODES: BriefMode[] = ['architect', 'unblock']
export const UNKNOWN_LINE = 'Unknown: nothing saved yet'

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

export function actionToBriefContext(action: { action_title: string; status: string; resume_note: string | null }): BriefActionContext {
  return { title: clip(action.action_title) ?? '', status: clip(action.status) ?? '', resumeNote: clip(action.resume_note) }
}

// Server-side validation of the target the client asked about. Every text
// field is clamped; a Break Wall target must name something actually saved
// on this mission — never a blocker or action the model would have to invent.
export function parseBriefTarget(mode: BriefMode, raw: unknown, mission: BriefMissionContext): { target: BriefTarget } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.slice(0, MAX_FIELD_LENGTH) : null)
  const a = r.action && typeof r.action === 'object' ? (r.action as Record<string, unknown>) : null
  const action = a && text(a.title) ? { title: text(a.title)!, status: text(a.status) ?? 'TODO', resumeNote: text(a.resumeNote) } : null
  if (action?.status === 'DONE') return { error: 'Only an unfinished action can be used here.' }
  const target: BriefTarget = { kind: r.kind as BriefTargetKind, evidenceRequirement: text(r.evidenceRequirement), action }
  if (mode === 'architect') return target.kind === 'mission' ? { target } : { error: 'Architect Scan needs kind "mission".' }
  if (target.kind === 'blocker') return mission.blocker?.trim() ? { target } : { error: 'This mission has no saved blocker.' }
  if (target.kind === 'action') return action ? { target } : { error: 'Break Wall needs a saved unfinished action.' }
  return { error: 'Break Wall needs kind "blocker" or "action".' }
}

// The request body for any mode asked about ONE mission (Brief's picker and
// Territory's detail panel). Only that mission and its id are sent.
export function singleMissionRequest(
  mode: BriefMode,
  mission: Mission,
  action: { action_title: string; status: string; resume_note: string | null } | null,
  wall: BriefTargetKind,
  question?: string,
) {
  const base = { mode, missions: [missionToBriefContext(mission)], missionIds: [mission.id] }
  if (mode !== 'architect' && mode !== 'unblock') return { ...base, question }
  const target: BriefTarget = {
    kind: mode === 'architect' ? 'mission' : wall,
    evidenceRequirement: clip(mission.evidenceRequirement),
    action: action ? actionToBriefContext(action) : null,
  }
  return { ...base, target }
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
export function buildBriefDirective(mode: BriefMode, missions: BriefMissionContext[], question?: string, target?: BriefTarget): string {
  if (missions.length === 0) {
    if (mode === 'question') {
      const q = (question ?? '').trim() || 'What matters most right now?'
      return `There are no saved missions for this account. Answer the question using only the person's supplied text; do not invent project context or claim anything was saved. Ask one concrete clarification if needed.\n\nQuestion: ${q}`
    }
    return 'No missions exist yet for this account. Say plainly that there is nothing to brief until a mission is added — do not invent one.'
  }

  if (mode === 'architect' || mode === 'unblock') {
    return target ? buildSingleMissionDirective(mode, missions[0], target) : 'No mission was chosen. Say plainly that a mission must be chosen first — do not pick one.'
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

function describeAction(action: BriefActionContext): string {
  return `"${action.title}" (${action.status})${action.resumeNote ? ` — resume note: ${action.resumeNote}` : ''}`
}

// Each Architect Scan line is bound to named saved fields. Where those fields
// are empty the directive itself carries the Unknown line, so "nothing saved"
// is decided here and testable, not left to the model's judgement.
function buildSingleMissionDirective(mode: 'architect' | 'unblock', m: BriefMissionContext, target: BriefTarget): string {
  const header = `The only mission in scope:\n${describeMission(m)}`
  if (mode === 'unblock') {
    const wall = target.kind === 'action' && target.action ? `Saved unfinished action: ${describeAction(target.action)}` : `Saved blocker: ${m.blocker}`
    return `${header}\n\nWall to break — ${wall}\n\nGive the smallest physical action or command that can be done in 30 minutes and makes measurable progress on exactly this wall. One sentence. Ground it only in the saved text above. If that text is too thin to ground a concrete step, output exactly: NONE`
  }

  const saved = (value: string | null | undefined) => value?.trim() || UNKNOWN_LINE
  const missing = [
    !m.finishLine && 'finish line',
    !target.evidenceRequirement && 'evidence requirement',
    !m.blocker && 'blocker',
    !target.action && 'unfinished action',
    !m.why && 'why',
  ].filter(Boolean)
  const blocking = m.blocker ?? (m.capacityMismatch ? 'capacity mismatch reported (no blocker text saved)' : null)
  const line = (label: string, source: string | null, rule: string) =>
    source ? `${label}: ${rule}` : `${label}: write exactly "${label}: ${UNKNOWN_LINE}"`

  return `${header}

Saved fields:
- Finish line: ${saved(m.finishLine)}
- Evidence requirement: ${saved(target.evidenceRequirement)}
- Blocker: ${saved(blocking)}
- Unfinished saved action: ${target.action ? describeAction(target.action) : UNKNOWN_LINE}

Return exactly six lines, in this order, each starting with its label. Use only the saved fields above.
${line('Intended end-state', m.finishLine || target.evidenceRequirement, 'restate what the finish line and evidence requirement say the finished state is')}
Current reality: summarize the state "${m.state}"${m.capacityMismatch ? ', the reported capacity mismatch' : ''} and the unfinished saved action, if any
${line("What's blocking", blocking, 'name the saved blocker; do not add any other blocker')}
${target.action ? 'Next safe action: name the unfinished saved action above' : line('Next safe action', m.finishLine, 'prefix with "Proposed:" and give one concrete step toward the finish line')}
${line('Real leverage', m.finishLine || m.why || null, 'prefix with "Proposed:" and name which saved field it rests on')}
Unknown: ${missing.length ? `list these unsaved fields — ${missing.join(', ')} — and anything else the saved text does not say` : 'name what the saved text does not say that would change this scan'}`
}

// Break Wall's NONE means the saved text could not ground a step. Show that
// in plain words instead of a bare token.
export function presentBriefText(mode: BriefMode, text: string): string {
  if (mode === 'unblock' && text.trim() === 'NONE') return `${UNKNOWN_LINE} that is specific enough for a 30-minute step. Add detail to the blocker or action, then try again.`
  return text || 'No brief text returned.'
}
