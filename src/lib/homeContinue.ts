import type { Mission } from '@/types'
import type { NextAction, NextActionReadState } from '@/lib/nextAction'

/**
 * What Home shows before anything is typed: what matters, the next step, and
 * why. A projection over rows Home already reads, never a second source of
 * truth and never a model call.
 *
 * The status words keep the distinctions the product depends on. A saved step
 * is a commitment the person made. An accepted suggestion is not saved. A
 * blocker is a reported obstacle. Nothing here reports work as done.
 */
export type ContinueStatus =
  | 'loading'
  | 'error'
  | 'no_missions'
  | 'no_primary'
  | 'in_progress'
  | 'saved'
  | 'suggested'
  | 'clarify'
  | 'accepted'
  | 'no_step'
  /** The mission and its actions loaded, but accepted suggestions could not be read. */
  | 'step_unknown'

export interface ContinueReason {
  label: string
  text: string
}

export interface HomeContinueView {
  status: ContinueStatus
  missionTitle: string | null
  /** The status of the step, in plain words. Null when there is no step. */
  stepLabel: string | null
  stepTitle: string | null
  /** Only ever the person's own saved blocker text. */
  blocker: string | null
  cta: string
  /** Shown only when a real saved value backs each line. */
  reasons: ContinueReason[]
}

export interface HomeContinueInput {
  readState: NextActionReadState
  missionCount: number
  mission: Mission | null
  nextAction: NextAction
  resumeNote?: string | null
  /** Unknown (null) when that read failed or is pending: never shown as zero. */
  correctionCount: number | null
  activeLessonCount: number | null
  /** False when the accepted-suggestion read failed. A saved step is still known. */
  acceptanceKnown?: boolean
}

const clean = (value: string | null | undefined) => value?.trim() || null

// A return note can hold a whole saved answer. Home shows its opening; Mission holds the rest.
const NOTE_LIMIT = 280
const clip = (value: string) => value.length > NOTE_LIMIT ? `${value.slice(0, NOTE_LIMIT).trimEnd()}… (full note in Mission)` : value

export function activeLessonCount(links: { id: string; type: string; detail: string | null }[]): number {
  const retired = new Set<string>()
  for (const row of links) {
    if (row.type !== 'delta_lesson_retired' || !row.detail) continue
    try {
      const id = (JSON.parse(row.detail) as { lessonId?: unknown }).lessonId
      if (typeof id === 'string') retired.add(id)
    } catch { /* an unreadable retirement retires nothing */ }
  }
  return links.filter(row => row.type === 'delta_lesson_confirmed' && !retired.has(row.id)).length
}

export function deriveHomeContinue(input: HomeContinueInput): HomeContinueView {
  const { mission, nextAction } = input
  const empty = { missionTitle: null, stepLabel: null, stepTitle: null, blocker: null, reasons: [] }
  if (input.readState === 'loading') return { ...empty, status: 'loading', cta: 'Open Mission' }
  if (input.readState === 'error') return { ...empty, status: 'error', cta: 'Open Mission' }
  if (!mission) {
    return input.missionCount === 0
      ? { ...empty, status: 'no_missions', cta: 'Name what matters' }
      : { ...empty, status: 'no_primary', cta: 'Choose what matters now' }
  }

  const reasons: ContinueReason[] = []
  const finishLine = clean(mission.finishLine)
  const why = clean(mission.why)
  const resumeNote = clean(input.resumeNote)
  const blocker = clean(mission.blocker)
  if (finishLine) reasons.push({ label: 'Done when', text: finishLine })
  if (why) reasons.push({ label: 'Why it matters', text: why })
  if (resumeNote) reasons.push({ label: 'Your return note', text: clip(resumeNote) })

  const found = nextAction.state === 'in_progress' || nextAction.state === 'saved' || nextAction.state === 'accepted'
    ? nextAction.state
    : 'no_step'
  // "No step" is only a fact when the accepted-suggestion read succeeded.
  const step = found === 'no_step' && input.acceptanceKnown === false ? 'step_unknown' : found
  if (step === 'accepted') {
    reasons.push({ label: 'Where this step came from', text: 'A suggestion you accepted. It is not saved as a commitment until you save it in Mission.' })
  } else if (step === 'saved' || step === 'in_progress') {
    reasons.push({ label: 'Where this step came from', text: 'You saved it. Codex has not checked whether it is done.' })
  }
  if (input.correctionCount) {
    reasons.push({
      label: 'Your corrections',
      text: `You marked ${input.correctionCount === 1 ? 'one suggestion' : `${input.correctionCount} suggestions`} on this mission “not right”. Those moves are no longer suggested.`,
    })
  }
  if (input.activeLessonCount !== null) {
    reasons.push({
      label: 'Lessons carried forward',
      text: input.activeLessonCount === 0
        ? 'None yet. A lesson appears here after you confirm one in Mission.'
        : `${input.activeLessonCount === 1 ? 'One lesson you confirmed is' : `${input.activeLessonCount} lessons you confirmed are`} available to Codex as context when you ask or review, within the scope you set. That is context supplied, not proof it changed an answer.`,
    })
  }

  return {
    status: step,
    missionTitle: mission.title,
    stepLabel: step === 'in_progress' ? 'In progress'
      : step === 'saved' ? 'Saved next step · not started'
      : step === 'accepted' ? 'Suggestion you accepted · not saved yet'
      : null,
    stepTitle: step === 'no_step' || step === 'step_unknown' ? null : nextAction.title,
    blocker,
    cta: step === 'in_progress' ? 'Resume this step'
      : step === 'saved' ? 'Start this step'
      : step === 'accepted' ? 'Review and save this step'
      : step === 'step_unknown' ? 'Open Mission'
      : blocker ? 'Work on the blocker'
      : 'Choose a next step',
    reasons,
  }
}
