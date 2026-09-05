import type { EvidenceRecord, NextMoveContext, NextMoveRecommendation } from '@/types'
import { hasConflict, isStale, isValidEvidenceRecord, STALE_AFTER_HOURS } from './evidence'

function missionEvidence(context: NextMoveContext): EvidenceRecord[] {
  const missionId = context.mission?.id
  return missionId ? context.evidence.filter(record => record.missionId === missionId) : []
}

function evidenceFreshness(record: EvidenceRecord, now: string): 'invalid' | 'stale' | 'fresh' {
  if (!isValidEvidenceRecord(record)
    || Date.parse(record.observedAt) > Date.parse(now)
    || Date.parse(record.fetchedAt) > Date.parse(now)) return 'invalid'
  // Re-fetching an old observation must not turn it into fresh evidence.
  return record.status === 'stale'
    || isStale(record.observedAt, now)
    || isStale(record.fetchedAt, now) ? 'stale' : 'fresh'
}

export function nextMoveContextKey(context: NextMoveContext, now: string): string {
  return JSON.stringify({
    ...context,
    evidence: missionEvidence(context).map(record => ({
      ...record,
      freshness: evidenceFreshness(record, now),
    })),
  })
}

// Invalidate an open suggestion when its evidence ages, even without a click.
export function nextMoveContextExpiresAt(context: NextMoveContext, now: string): number | null {
  const nowMs = Date.parse(now)
  const expiries = missionEvidence(context).flatMap(record => [record.observedAt, record.fetchedAt])
    .map(timestamp => Date.parse(timestamp) + STALE_AFTER_HOURS * 60 * 60 * 1000 + 1)
    .filter(expiry => Number.isFinite(expiry) && expiry > nowMs)
  return expiries.length ? Math.min(...expiries) : null
}

export function recommendNextMove(
  intent: string,
  context: NextMoveContext,
  now: string = new Date().toISOString(),
): NextMoveRecommendation {
  const { mission, missionStatus, evidenceStatus } = context
  const evidence = missionEvidence(context)
  type Decision = Omit<NextMoveRecommendation, 'handoff' | 'source'>

  function result(decision: Decision): NextMoveRecommendation {
    const lines = [
      'Suggested only — not committed or started. Source: local rules.',
      `Mission context: ${missionStatus}`,
    ]
    if (missionStatus === 'ready' && mission) {
      lines.push(`Mission: ${mission.title}`, `Finish line: ${mission.finishLine ?? 'not defined'}`,
        `State: ${mission.state}`, `Blocker: ${mission.blocker ?? 'none recorded'}`,
        `Capacity mismatch reported: ${mission.capacityMismatch ? 'yes' : 'no'}`,
        `Evidence requirement: ${mission.evidenceRequirement ?? 'not defined'}`)
    }
    lines.push(`Evidence context: ${evidenceStatus}`)
    if (missionStatus === 'ready' && mission && evidenceStatus === 'ready') {
      for (const record of evidence) {
        lines.push(`Evidence [${record.id}; ${record.status}; ${evidenceFreshness(record, now)}]: ${record.claim}`,
          `Source: ${record.source}; observed: ${record.observedAt}; fetched: ${record.fetchedAt}`)
      }
      if (!evidence.length) lines.push('No evidence linked to this mission was returned.')
    }
    if (intent.trim()) lines.push(`Your request: ${intent.trim()}`)
    lines.push(`Next move: ${decision.nextMove}`, `Why: ${decision.why}`, `Required evidence: ${decision.evidenceNeeded}`)
    return { ...decision, handoff: lines.join('\n'), source: 'local-rules' }
  }

  if (missionStatus === 'loading') return result({
    reason: 'loading', kind: 'review', label: 'Reading your context',
    nextMove: 'Wait for your saved mission to load before choosing a move.',
    why: 'The Primary mission is still loading; it is not known to be absent.',
    evidenceNeeded: 'A completed mission read.',
  })
  if (missionStatus === 'unavailable') return result({
    reason: 'mission_unavailable', kind: 'review', label: 'Reconnect to your mission',
    nextMove: 'Reload to reconnect to your saved missions before choosing a move.',
    why: 'Saved mission context is unavailable. Your typed request alone cannot establish your Primary mission or its constraints.',
    evidenceNeeded: 'A successful account connection and mission read.',
  })
  if (!mission) return result({
    reason: 'no_primary', kind: 'question', label: 'Choose your focus',
    nextMove: 'Which saved mission should be your Primary focus?',
    why: 'Your missions loaded, but none is Primary. Capture a mission if needed, define its finish line, then explicitly make it Primary.',
    evidenceNeeded: 'A mission you have explicitly selected as Primary.',
  })
  if (mission.state !== 'primary') return result({
    reason: 'inactive_mission', kind: 'review', label: 'Review the current focus',
    nextMove: `Review “${mission.title}” before resuming it; its saved state is ${mission.state}.`,
    why: 'This mission is not currently Primary. A suggestion must not reactivate it or replace your focus.',
    evidenceNeeded: 'An explicit Primary selection in the mission controls.',
  })
  if (mission.blocker?.trim()) return result({
    reason: 'blocker', kind: 'question', label: 'Address the known blocker',
    nextMove: `What is needed to resolve “${mission.blocker.trim()}” for “${mission.title}”?`,
    why: 'Your Primary has a recorded blocker. General build or release advice would ignore it.',
    evidenceNeeded: `Confirmation that “${mission.blocker.trim()}” is resolved before unblocking the mission.`,
  })
  if (mission.capacityMismatch) return result({
    reason: 'capacity', kind: 'question', label: 'Make the move fit your capacity',
    nextMove: `What smaller step toward “${mission.finishLine || mission.title}” fits your reported capacity?`,
    why: 'You reported that the Primary does not fit your capacity. The helper will not infer your energy or silently switch missions.',
    evidenceNeeded: 'A step you confirm fits, or an explicit priority decision in the mission controls.',
  })
  if (!mission.finishLine?.trim()) return result({
    reason: 'finish_line', kind: 'question', label: 'Define this mission’s finish line',
    nextMove: `What observable outcome would complete “${mission.title}”?`,
    why: 'This mission has no defined finish line to choose an action against.',
    evidenceNeeded: 'A finish line saved on this mission.',
  })
  if (evidenceStatus !== 'ready') return result({
    reason: 'evidence_unavailable', kind: 'review', label: evidenceStatus === 'loading' ? 'Waiting for evidence' : 'Reconnect to evidence',
    nextMove: evidenceStatus === 'loading'
      ? `Wait for the evidence for “${mission.title}” to load.`
      : `Reload to retrieve the evidence for “${mission.title}” before deciding what remains.`,
    why: 'An incomplete or failed evidence read is not proof that no evidence exists.',
    evidenceNeeded: 'A successful evidence read for this mission.',
  })
  if (evidence.some(record => evidenceFreshness(record, now) === 'invalid')) return result({
    reason: 'evidence_invalid', kind: 'review', label: 'Check the evidence record',
    nextMove: `Review the evidence records and timestamps for “${mission.title}”.`,
    why: 'At least one linked record has an invalid shape or a future timestamp; it cannot support a current decision.',
    evidenceNeeded: 'A valid, dated observation from its original source.',
  })
  if (hasConflict(evidence)) return result({
    reason: 'evidence_conflict', kind: 'review', label: 'Resolve the evidence conflict',
    nextMove: `Compare the conflicting records in “Context and handoff” before deciding what remains for “${mission.title}”.`,
    why: 'The linked evidence has conflicting statuses. The helper cannot choose which claim is true.',
    evidenceNeeded: 'A source-backed resolution that preserves the conflicting claims.',
  })
  const stale = evidence.find(record => evidenceFreshness(record, now) === 'stale')
  if (stale) return result({
    reason: 'evidence_stale', kind: 'review', label: 'Refresh the stale evidence',
    nextMove: `Recheck “${stale.claim}” at its source before using it to choose a move.`,
    why: `This record is marked stale or exceeds the ${STALE_AFTER_HOURS}-hour freshness window. Observed: ${stale.observedAt}; fetched: ${stale.fetchedAt}.`,
    evidenceNeeded: `A fresh observation from ${stale.source}.`,
  })
  const unverified = evidence.find(record => record.status !== 'verified')
  if (unverified) return result({
    reason: 'evidence_unverified', kind: 'review', label: 'Verify the open claim',
    nextMove: `Verify “${unverified.claim}” against its source before treating it as completed work.`,
    why: 'A linked claim is still unverified. It cannot establish what has already been accomplished.',
    evidenceNeeded: `Verification from ${unverified.source}.`,
  })
  if (!evidence.length) return result({
    reason: 'evidence_missing', kind: 'question', label: 'Establish what is already done',
    nextMove: `What, if anything, has already been completed toward “${mission.finishLine}”?`,
    why: `The evidence read succeeded, but returned no records linked to “${mission.title}”. That does not establish that no work has happened.`,
    evidenceNeeded: mission.evidenceRequirement || 'A source-backed current-state record, or your confirmation that this mission is just starting.',
  })
  return result({
    reason: 'next_action', kind: 'question', label: 'Name the unfinished step',
    nextMove: `What is the next unfinished action toward “${mission.finishLine}”?`,
    why: `The linked evidence is marked verified and within the freshness window, but this helper has no recorded next action for “${mission.title}”. Evidence alone does not establish completion or a best action.`,
    evidenceNeeded: mission.evidenceRequirement || 'One explicit action with an observable completion check.',
  })
}
