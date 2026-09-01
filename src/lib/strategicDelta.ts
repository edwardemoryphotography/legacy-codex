// The predictive Strategic Delta engine.
//
// Lineage: this is the same function `foundry-console/src/lib/derived-state.ts`
// performs for the builder layer (whatMattersNow / why / currentBlocker /
// nextAction / provenance, honest nulls), and the same function the historical
// iOS companion's `strategicDeltaTitle` ladder performed over Daily Boot +
// project next actions. It is deliberately re-implemented here rather than
// imported: Legacy Codex is the human front door and must not depend on
// Foundry, the internal builder layer.
//
// Pipeline — assemble → route → generate candidates → inhibit → select.
// Everything here is pure. No I/O, no clock, no randomness: `now` is passed
// in. A Delta is a *prediction*; nothing in this module writes an Action.
//
// No mock values, fixtures, or fallbacks. When there is nothing to predict
// from, the engine says so explicitly and names the one missing input.

import type {
  DeltaCandidate,
  DeltaCorrection,
  DeltaEvidenceState,
  DeltaInhibitionReason,
  DeltaSituation,
  EvidenceRecord,
  InhibitedCandidate,
  Mission,
  StrategicDelta,
} from '@/types'
import { isStale } from './evidence'

// ─── Stage A — Context assembly ─────────────────────────────────────────
// Assemble only what is trustworthy and relevant. Historical CSF's job.

export interface DeltaContext {
  primary: Mission | null
  secondary: Mission | null
  /** Everything eligible to become Primary or Secondary later. */
  parked: Mission[]
  /** Evidence attached to the Primary mission only. */
  primaryEvidence: EvidenceRecord[]
  corrections: DeltaCorrection[]
  now: string
}

export function assembleDeltaContext(
  missions: Mission[],
  evidence: EvidenceRecord[],
  corrections: DeltaCorrection[],
  now: string,
): DeltaContext {
  const primary = missions.find(m => m.state === 'primary') ?? null
  const secondary = missions.find(m => m.state === 'secondary') ?? null

  // Sorted newest-touched first, matching the historical companion's
  // priority tiebreak (`$0.updatedAt > $1.updatedAt`).
  const parked = missions
    .filter(m => m.state === 'parked' || m.state === 'candidate' || m.state === 'blocked')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const primaryEvidence = primary ? evidence.filter(e => e.missionId === primary.id) : []

  return { primary, secondary, parked, primaryEvidence, corrections, now }
}

export function summarizeEvidence(records: EvidenceRecord[], now: string): DeltaEvidenceState {
  if (records.length === 0) return 'none'
  if (records.some(r => r.status === 'conflict')) return 'conflict'
  // Two sources disagreeing is a conflict even when neither row is flagged.
  const statuses = new Set(records.map(r => r.status))
  if (statuses.has('verified') && statuses.size > 1) return 'conflict'
  if (records.some(r => r.status === 'stale' || isStale(r.fetchedAt, now))) return 'stale'
  if (records.some(r => r.status === 'unverified')) return 'unverified'
  return 'verified'
}

// ─── Stage B — Routing ──────────────────────────────────────────────────
// What kind of situation is this? Historical LAR's job. Routing decides
// which candidates are worth generating at all.

export function routeSituation(ctx: DeltaContext): DeltaSituation {
  const evidenceState = summarizeEvidence(ctx.primaryEvidence, ctx.now)

  // Contradictory evidence is a prior gate: acting on state that two
  // sources disagree about is acting on unverified information.
  if (evidenceState === 'conflict') return 'evidence_conflict'
  if (ctx.primary?.blocker) return 'primary_blocked'
  if (ctx.primary) return 'primary_active'
  if (ctx.parked.some(m => m.finishLine)) return 'no_primary_ready'
  if (ctx.parked.length > 0) return 'no_primary_unready'
  return 'empty'
}

// ─── Stage C — Candidate generation ─────────────────────────────────────
// A small set of plausible moves. Never shown as a menu by default —
// reducing decision cost is the whole point.

const RANK = {
  reconcileEvidence: 0,
  advancePrimary: 1,
  clearBlocker: 5,
  advanceSecondary: 6,
  promoteToPrimary: 20,
  setFinishLine: 30,
} as const

export function generateCandidates(ctx: DeltaContext): DeltaCandidate[] {
  const out: DeltaCandidate[] = []
  const { primary, secondary, parked } = ctx

  if (primary) {
    if (ctx.primaryEvidence.length > 0) {
      out.push({
        id: `reconcile:${primary.id}`,
        move: `Reconcile the conflicting evidence on “${primary.title}” before acting on it.`,
        missionId: primary.id,
        rank: RANK.reconcileEvidence,
      })
    }
    if (primary.blocker) {
      out.push({
        id: `unblock:${primary.id}`,
        move: `Clear what's blocking “${primary.title}”: ${primary.blocker}`,
        missionId: primary.id,
        rank: RANK.clearBlocker,
      })
    }
    if (primary.finishLine) {
      out.push({
        id: `advance:${primary.id}`,
        move: `Move “${primary.title}” toward: ${primary.finishLine}`,
        missionId: primary.id,
        rank: RANK.advancePrimary,
      })
    }
  }

  if (secondary?.finishLine) {
    out.push({
      id: `advance:${secondary.id}`,
      move: `Move “${secondary.title}” toward: ${secondary.finishLine}`,
      missionId: secondary.id,
      rank: RANK.advanceSecondary,
    })
  }

  parked.forEach((m, index) => {
    if (m.finishLine) {
      out.push({
        id: `promote:${m.id}`,
        move: `Make “${m.title}” your Primary Mission and start on: ${m.finishLine}`,
        missionId: m.id,
        // Preserve the newest-touched ordering as leverage order.
        rank: RANK.promoteToPrimary + index,
      })
    } else {
      out.push({
        id: `finish-line:${m.id}`,
        move: `Give “${m.title}” an exact finish line, so it can become actionable.`,
        missionId: m.id,
        rank: RANK.setFinishLine + index,
      })
    }
  })

  return out
}

// ─── Stage D — Inhibition ───────────────────────────────────────────────
// Historical REK's job, and the most important stage. REK kills weak
// candidates; it is not a motivational coach. Every rule here is
// structural — it names a reason the move is wrong *right now*, never a
// judgement about the work or the person.

export interface InhibitionResult {
  surviving: DeltaCandidate[]
  inhibited: InhibitedCandidate[]
}

function kill(
  candidate: DeltaCandidate,
  reason: DeltaInhibitionReason,
  explanation: string,
): InhibitedCandidate {
  return { ...candidate, reason, explanation }
}

export function inhibit(candidates: DeltaCandidate[], ctx: DeltaContext): InhibitionResult {
  const situation = routeSituation(ctx)
  const surviving: DeltaCandidate[] = []
  const inhibited: InhibitedCandidate[] = []

  for (const candidate of candidates) {
    // 1. The user already said this one is wrong. A correction is durable
    //    and outranks every other rule — it is an explicit user policy.
    const correction = ctx.corrections.find(c => c.correctedMove === candidate.move)
    if (correction) {
      inhibited.push(kill(candidate, 'corrected', `You said this isn't right: ${correction.reason}`))
      continue
    }

    // 2. While sources disagree, everything except reconciling them is
    //    built on information that has not been verified.
    if (situation === 'evidence_conflict' && !candidate.id.startsWith('reconcile:')) {
      inhibited.push(kill(
        candidate,
        'unverified_state',
        'Two sources disagree about this mission — acting now would build on unverified state.',
      ))
      continue
    }

    // 3. Advancing a mission that is blocked is blocked by something more
    //    fundamental than the move itself.
    if (candidate.id.startsWith('advance:') && candidate.missionId === ctx.primary?.id && ctx.primary.blocker) {
      inhibited.push(kill(candidate, 'blocked', `Blocked by: ${ctx.primary.blocker}`))
      continue
    }

    // 4. A parked mission cannot quietly displace an active Primary. That
    //    is a priority challenge, and it requires stating what changed.
    if (candidate.id.startsWith('promote:') && ctx.primary) {
      inhibited.push(kill(
        candidate,
        'displaces_primary',
        `“${ctx.primary.title}” is already Primary. Replacing it needs a priority challenge, not a silent swap.`,
      ))
      continue
    }

    // 5. A mission with no finish line has no end state to move toward.
    if (candidate.id.startsWith('finish-line:') && ctx.primary) {
      inhibited.push(kill(
        candidate,
        'no_finish_line',
        'No finish line, and a Primary mission is already active — this is not the constraint right now.',
      ))
      continue
    }

    surviving.push(candidate)
  }

  // 6. Among what is left, only the highest-leverage move survives.
  //    Everything else is real, just not first.
  const ranked = surviving.slice().sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  const [winner, ...rest] = ranked

  for (const loser of rest) {
    inhibited.push(kill(
      loser,
      'lower_leverage',
      winner
        ? `Lower leverage than the selected move right now.`
        : 'Lower leverage.',
    ))
  }

  return {
    surviving: winner ? [winner] : [],
    inhibited: inhibited.sort((a, b) => a.rank - b.rank),
  }
}

// ─── Stage E/F — Selection and provenance ───────────────────────────────

const INSUFFICIENT_CONTEXT_MOVE =
  'Name the one outcome that matters most right now, and the finish line that ends it.'

function describeReality(ctx: DeltaContext): string {
  const parts: string[] = []
  if (ctx.primary) {
    parts.push(
      ctx.primary.blocker
        ? `“${ctx.primary.title}” is Primary and blocked`
        : `“${ctx.primary.title}” is Primary`,
    )
  } else {
    parts.push('No Primary mission is set')
  }
  if (ctx.secondary) parts.push(`“${ctx.secondary.title}” is Secondary`)
  if (ctx.parked.length > 0) {
    const ready = ctx.parked.filter(m => m.finishLine).length
    parts.push(
      `${ctx.parked.length} parked (${ready} with a finish line)`,
    )
  }
  const evidenceState = summarizeEvidence(ctx.primaryEvidence, ctx.now)
  if (evidenceState !== 'none') {
    parts.push(`evidence on the Primary is ${evidenceState}`)
  }
  return `${parts.join('; ')}.`
}

function describeWouldChange(situation: DeltaSituation, ctx: DeltaContext): string {
  switch (situation) {
    case 'evidence_conflict':
      return 'One source is confirmed and the disagreement resolves.'
    case 'primary_blocked':
      return ctx.secondary
        ? `The blocker clears, or you report that it needs someone else — then “${ctx.secondary.title}” becomes the move.`
        : 'The blocker clears, or you report that it needs someone else.'
    case 'primary_active':
      return `“${ctx.primary?.title ?? 'The Primary'}” gets blocked, new evidence contradicts it, or you make something else Primary.`
    case 'no_primary_ready':
      return 'A different parked mission gets a finish line, or something more urgent gets captured.'
    case 'no_primary_unready':
      return 'Any parked mission gets an exact finish line.'
    case 'empty':
      return 'Any mission exists with a finish line — then this becomes a prediction instead of a request.'
  }
}

function describeBecause(situation: DeltaSituation, ctx: DeltaContext): string {
  switch (situation) {
    case 'evidence_conflict':
      return 'Two sources disagree about this mission. Nothing built on top of that is trustworthy until it is resolved.'
    case 'primary_blocked':
      return `“${ctx.primary?.title ?? 'The Primary mission'}” is the outcome that matters, and this blocker is the only thing standing between it and progress.`
    case 'primary_active':
      return `“${ctx.primary?.title ?? 'This'}” is the one outcome currently designated Primary, and nothing is blocking it.`
    case 'no_primary_ready':
      return `Nothing is Primary right now, and of the ${ctx.parked.length} parked, this is the most recently worked one that already names an end state.`
    case 'no_primary_unready':
      return 'Missions exist, but none of them names an end state — so none of them can be predicted from yet.'
    case 'empty':
      return 'There is no mission state to predict from. This is the one input that turns everything downstream on.'
  }
}

export function selectStrategicDelta(ctx: DeltaContext): StrategicDelta {
  const situation = routeSituation(ctx)
  const candidates = generateCandidates(ctx)
  const { surviving, inhibited } = inhibit(candidates, ctx)
  const evidenceState = summarizeEvidence(ctx.primaryEvidence, ctx.now)

  const assembledFrom = [
    ctx.primary ? '1 Primary mission' : 'no Primary mission',
    ctx.secondary ? '1 Secondary mission' : null,
    ctx.parked.length > 0 ? `${ctx.parked.length} parked mission${ctx.parked.length === 1 ? '' : 's'}` : null,
    `${ctx.primaryEvidence.length} evidence record${ctx.primaryEvidence.length === 1 ? '' : 's'}`,
    ctx.corrections.length > 0
      ? `${ctx.corrections.length} correction${ctx.corrections.length === 1 ? '' : 's'} you recorded`
      : null,
  ].filter((x): x is string => x !== null)

  const winner = surviving[0]

  // Nothing survived — either there was never anything to predict from, or
  // every candidate was inhibited. Both are honest states, never padded
  // with a guess.
  if (!winner) {
    const everythingCorrected = candidates.length > 0
    return {
      move: everythingCorrected
        ? 'Add what changed, so there is something new to predict from.'
        : INSUFFICIENT_CONTEXT_MOVE,
      provenance: 'insufficient_context',
      situation,
      missionId: null,
      missionTitle: null,
      because: everythingCorrected
        ? 'Every move currently supportable has been corrected. Nothing new has come in since.'
        : describeBecause(situation, ctx),
      currentReality: describeReality(ctx),
      blockingGap: everythingCorrected
        ? 'No uncorrected move remains.'
        : 'No mission names an outcome and a finish line.',
      evidenceState,
      inhibited,
      wouldChangeIf: describeWouldChange(situation, ctx),
      assembledFrom,
      computedAt: ctx.now,
    }
  }

  const mission =
    [ctx.primary, ctx.secondary, ...ctx.parked].find(m => m?.id === winner.missionId) ?? null

  return {
    move: winner.move,
    provenance: 'deterministic',
    situation,
    missionId: winner.missionId,
    missionTitle: mission?.title ?? null,
    because: describeBecause(situation, ctx),
    currentReality: describeReality(ctx),
    blockingGap: ctx.primary?.blocker ?? null,
    evidenceState,
    inhibited,
    wouldChangeIf: describeWouldChange(situation, ctx),
    assembledFrom,
    computedAt: ctx.now,
  }
}

/** Convenience: assemble and select in one call. */
export function predictStrategicDelta(
  missions: Mission[],
  evidence: EvidenceRecord[],
  corrections: DeltaCorrection[],
  now: string,
): StrategicDelta {
  return selectStrategicDelta(assembleDeltaContext(missions, evidence, corrections, now))
}
