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
  DeltaProofStep,
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
  // Caller-supplied, model-derived operation candidates for a specific
  // finish-line clause (see `clauseId`). The engine never fetches these —
  // it only ever consumes what it is handed, runs it through the same
  // quality gate and inhibition as everything deterministic, and stays
  // synchronous either way. A Delta with no model stage wired up is exactly
  // as honest as one that tried and got nothing back.
  suggestedOperations: DeltaCandidate[]
  now: string
}

export function assembleDeltaContext(
  missions: Mission[],
  evidence: EvidenceRecord[],
  corrections: DeltaCorrection[],
  now: string,
  suggestedOperations: DeltaCandidate[] = [],
): DeltaContext {
  const primary = missions.find(m => m.state === 'primary') ?? null
  const secondary = missions.find(m => m.state === 'secondary') ?? null

  // Sorted newest-touched first, matching the historical companion's
  // priority tiebreak (`$0.updatedAt > $1.updatedAt`).
  const parked = missions
    .filter(m => m.state === 'parked' || m.state === 'candidate' || m.state === 'blocked')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const primaryEvidence = primary ? evidence.filter(e => e.missionId === primary.id) : []

  return { primary, secondary, parked, primaryEvidence, corrections, suggestedOperations, now }
}

/** Stable identity for finish-line clause N of this mission. This identifies
 *  the unresolved proof target, not any candidate operation aimed at it. */
export function clauseId(missionId: string, index: number): string {
  return `clause:${missionId}:${index}`
}

/** A stable, operation-specific identity. The move is part of the identity so
 *  correcting candidate A inhibits A without inhibiting candidate B for the
 *  same unresolved proof target. */
export function operationCandidateId(targetId: string, move: string): string {
  let hash = 2166136261
  for (let index = 0; index < move.length; index += 1) {
    hash ^= move.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${targetId}:operation:${(hash >>> 0).toString(36)}`
}

export function candidateTargetsClause(candidateId: string | undefined, targetId: string): boolean {
  return candidateId === targetId || candidateId?.startsWith(`${targetId}:operation:`) === true
}

function parseClauseId(targetId: string | undefined): { missionId: string; index: number } | null {
  if (!targetId) return null
  const match = /^clause:([^:]+):(\d+)$/.exec(targetId)
  if (!match) return null
  return { missionId: match[1], index: Number(match[2]) }
}

export function summarizeEvidence(records: EvidenceRecord[], now: string): DeltaEvidenceState {
  if (records.length === 0) return 'none'
  if (records.some(r => r.status === 'conflict')) return 'conflict'
  // Verification status is not claim content. A verified row beside an
  // unverified row does not prove the sources disagree; only an explicit
  // conflict status can support that assertion.
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
  // A blocker has an escape-hatch candidate (clear it); a reported capacity
  // mismatch does not — missionLoop.ts has no action that un-reports one.
  // So this is its own situation, not folded into primary_blocked.
  if (ctx.primary?.capacityMismatch) return 'primary_capacity_mismatch'
  if (ctx.primary) return 'primary_active'
  if (ctx.parked.some(m => m.finishLine)) return 'no_primary_ready'
  if (ctx.parked.length > 0) return 'no_primary_unready'
  return 'empty'
}

// ─── Stage C — Candidate generation ─────────────────────────────────────
// A small set of plausible moves. Never shown as a menu by default —
// reducing decision cost is the whole point.

// ─── The quality bar ────────────────────────────────────────────────────
// The first real product test failed on exactly this: the engine offered
// `Move "<mission>" toward: <finish line>`, which is the destination
// concatenated to itself, and the human correctly said "this is not a next
// move". So the invariant is enforced structurally rather than learned from
// that one sentence:
//
//   A move must introduce at least one non-vacuous operation beyond the
//   vocabulary the mission already uses to describe where it is going.
//
// This is a criterion, not a phrase blacklist. `VACUOUS_OPERATIONS` only
// defines which words fail to *name an operation* — a move that says
// "advance" and nothing else names no operation; a move that says "advance
// X by calling Beau" does.

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'for', 'from',
  'has', 'have', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'not',
  'of', 'on', 'one', 'or', 'so', 'than', 'that', 'the', 'then', 'this', 'to',
  'toward', 'towards', 'until', 'up', 'was', 'what', 'when', 'which', 'while',
  'with', 'without', 'you', 'your',
])

// Frame words a template reaches for when it has nothing real to say —
// "this part", "the thing", "that step" — carry no content of their own.
// Without these, "Verify this part of your finish line" reads as concrete
// because "part"/"finish"/"line" look like new tokens; they're scaffolding.
const SCAFFOLD_NOUNS = new Set([
  'part', 'piece', 'item', 'thing', 'step', 'clause', 'section',
  // Legacy Codex's own vocabulary for talking about a mission, not content
  // any real mission would use to distinguish itself. Without these, a
  // template built from this app's own words about itself ("this part of
  // your finish line") reads as new content purely because the mission's
  // own text rarely repeats the words "finish" or "line" back.
  'mission', 'outcome', 'finish', 'line', 'operation', 'action',
])

const VACUOUS_OPERATIONS = new Set([
  'address', 'advance', 'complete', 'continue', 'do', 'finish', 'handle',
  'make', 'move', 'progress', 'prove', 'pursue', 'tackle', 'work',
  // Naming that something should be checked is not the same as naming the
  // check. These verbs are fine riding alongside a real object ("verify
  // the correction survived reload"); alone, or alongside only scaffolding,
  // they are the exact template shape the first two real tests exposed.
  'verify', 'check', 'confirm', 'review', 'inspect', 'examine',
])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// A light suffix stem, so "shipping" is recognised as the mission's own
// "ship" rather than as new content. Deliberately crude: it only has to make
// morphological variants of the same word collide.
function stem(word: string): string {
  let w = word
  if (w.length > 4 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 3 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s')) w = w.slice(0, -1)
  if (w.length > 3 && /([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1)
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1)
  if (w.length > 2 && w.endsWith('i')) w = `${w.slice(0, -1)}y`
  return w
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean).map(stem)
}

/**
 * True when `move` names something to do that the mission's own description
 * of its destination does not already say.
 */
export function isConcreteMove(
  move: string,
  mission: { title: string; finishLine: string | null },
): boolean {
  const destination = new Set(tokens(`${mission.title} ${mission.finishLine ?? ''}`))
  const stopped = new Set([...STOPWORDS, ...SCAFFOLD_NOUNS].map(stem))
  const vacuous = new Set([...VACUOUS_OPERATIONS].map(stem))
  const introduced = tokens(move).filter(t => !stopped.has(t) && !destination.has(t))
  if (introduced.length === 0) return false
  return !introduced.every(t => vacuous.has(t))
}

/**
 * A finish line is often written as a sequence of proofs joined by commas
 * and "and". Splitting it gives the engine something smaller than the whole
 * outcome to aim at. Fragments are kept verbatim — they are the human's own
 * words, and quoting them back is honest where paraphrasing them would not be.
 */
export function decomposeFinishLine(finishLine: string | null): string[] {
  if (!finishLine) return []
  const parts = finishLine
    .replace(/[.\s]+$/, '')
    .split(/,\s*(?:and\s+|then\s+)?|\s+and\s+|;\s*|\s+then\s+/i)
    .map(part => part.trim())
    .filter(Boolean)
  // One part means it did not decompose — the whole finish line is not a
  // smaller target than itself.
  return parts.length > 1 ? parts : []
}

// Bands are spaced so adding steps inside one never reorders another.
const RANK = {
  reconcileEvidence: 0,
  clearBlocker: 100,
  // Where a model-derived operation for one clause slots in: it beats a
  // mission's single-clause evidence framing (a genuinely derivable
  // operation for a *specific* unresolved part outranks a generic one for
  // the whole mission) but never beats reconciling evidence or a blocker.
  modelSuggestion: 150,
  primaryEvidence: 300,
  promoteToPrimary: 500,
  setFinishLine: 600,
  wholeMission: 900,
} as const

// When a finish line does not decompose into multiple clauses, the concrete
// move is about the proof itself: completion is evidence-gated, so either
// name the evidence or go produce it. Both introduce an operation the
// mission statement does not. When it DOES decompose, this stays silent —
// naming generic "evidence" for the whole mission would outrank an actual
// per-clause operation, and defeat the point of decomposing at all.
function evidenceCandidate(mission: Mission, band: number): DeltaCandidate | null {
  if (decomposeFinishLine(mission.finishLine).length > 0) return null
  return mission.evidenceRequirement
    ? {
        id: `produce-evidence:${mission.id}`,
        kind: 'produce_evidence',
        move: `Produce the evidence that closes “${mission.title}”: ${mission.evidenceRequirement}`,
        missionId: mission.id,
        rank: band,
      }
    : {
        id: `name-evidence:${mission.id}`,
        kind: 'name_evidence',
        move: `Name the evidence that will prove “${mission.title}” is genuinely done.`,
        missionId: mission.id,
        rank: band,
      }
}

export function generateCandidates(ctx: DeltaContext): DeltaCandidate[] {
  const out: DeltaCandidate[] = []
  const { primary, secondary, parked } = ctx
  const targetMissionIds = new Set([primary?.id, secondary?.id].filter((id): id is string => Boolean(id)))

  if (primary) {
    if (summarizeEvidence(ctx.primaryEvidence, ctx.now) === 'conflict') {
      out.push({
        id: `reconcile:${primary.id}`,
        kind: 'reconcile_evidence',
        move: `Reconcile the conflicting evidence on “${primary.title}” before acting on it.`,
        missionId: primary.id,
        rank: RANK.reconcileEvidence,
      })
    }
    if (primary.blocker) {
      out.push({
        id: `unblock:${primary.id}`,
        kind: 'clear_blocker',
        move: `Clear what's blocking “${primary.title}”: ${primary.blocker}`,
        missionId: primary.id,
        rank: RANK.clearBlocker,
      })
    }

    const evidence = evidenceCandidate(primary, RANK.primaryEvidence)
    if (evidence) out.push(evidence)

    if (primary.finishLine) {
      // Deliberately still generated, and deliberately never selected: it
      // fails `isConcreteMove`, so it shows up in the Why? trace as an
      // alternative the engine rejected. Keeping it visible is the point —
      // and the wording is frozen, because corrections recorded against it
      // are matched by their prose.
      out.push({
        id: `advance:${primary.id}`,
        kind: 'whole_mission',
        move: `Move “${primary.title}” toward: ${primary.finishLine}`,
        missionId: primary.id,
        rank: RANK.wholeMission,
      })
    }
  }

  if (secondary?.finishLine) {
    out.push({
      id: `advance:${secondary.id}`,
      kind: 'whole_mission',
      move: `Move “${secondary.title}” toward: ${secondary.finishLine}`,
      missionId: secondary.id,
      rank: RANK.wholeMission + 1,
    })
  }

  parked.forEach((m, index) => {
    if (m.finishLine) {
      out.push({
        id: `promote:${m.id}`,
        kind: 'promote_to_primary',
        move: `Make “${m.title}” your Primary Mission and start on: ${m.finishLine}`,
        missionId: m.id,
        // Preserve the newest-touched ordering as leverage order.
        rank: RANK.promoteToPrimary + index,
      })
    } else {
      out.push({
        id: `finish-line:${m.id}`,
        kind: 'set_finish_line',
        move: `Give “${m.title}” an exact finish line, so it can become actionable.`,
        missionId: m.id,
        rank: RANK.setFinishLine + index,
      })
    }
  })

  // Model-derived operations for a specific clause. Trusted no further than
  // any deterministic candidate: same rank tier applied uniformly here
  // (the caller's own rank is ignored) regardless of what the caller set,
  // and every one of these still has to survive `inhibit` — including the
  // `isConcreteMove` gate — like everything else in `out`.
  for (const suggestion of ctx.suggestedOperations) {
    if (!suggestion.missionId || !targetMissionIds.has(suggestion.missionId)) continue
    const target = parseClauseId(suggestion.targetId)
    if (!target || target.missionId !== suggestion.missionId) continue
    const owner = [primary, secondary].find(m => m?.id === suggestion.missionId)
    const clauses = decomposeFinishLine(owner?.finishLine ?? null)
    // Until trusted state says a target is resolved, the first target remains
    // unresolved. A rejected operation may generate a new candidate for it;
    // it may not silently unlock a later clause.
    if (target.index !== 0 || !clauses[target.index]) continue
    out.push({ ...suggestion, kind: 'model_suggested', rank: RANK.modelSuggestion })
  }

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
    //    Matched by candidate id when the correction carries one, and by
    //    prose otherwise, so corrections recorded before ids existed still
    //    match and a later copy change cannot silently orphan them.
    const correction = ctx.corrections.find(c =>
      c.candidateId ? c.candidateId === candidate.id : c.correctedMove === candidate.move,
    )
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

    // 3. A move that only restates where the mission is going is not a
    //    move. This is the bar the first real product test exposed: the
    //    engine must not offer the destination back as the next step.
    const owner = [ctx.primary, ctx.secondary, ...ctx.parked].find(m => m?.id === candidate.missionId)
    if (owner && !isConcreteMove(candidate.move, owner)) {
      inhibited.push(kill(
        candidate,
        'not_a_move',
        'This restates the mission and its finish line instead of naming something to do.',
      ))
      continue
    }

    // 4. Advancing a mission that is blocked is blocked by something more
    //    fundamental than the move itself.
    //    Clearing the blocker is the only primary-side move that survives —
    //    which is exactly what makes the Secondary actionable (spec §5).
    if (
      candidate.kind !== 'clear_blocker' &&
      candidate.missionId === ctx.primary?.id &&
      ctx.primary.blocker
    ) {
      inhibited.push(kill(candidate, 'blocked', `Blocked by: ${ctx.primary.blocker}`))
      continue
    }

    // 4b. A reported capacity mismatch is the other route to an actionable
    //    Secondary (spec §5). Unlike a blocker, nothing un-reports it, so
    //    every Primary-side candidate defers — there is no escape hatch to
    //    exempt the way clear_blocker is exempted above.
    if (
      candidate.missionId === ctx.primary?.id &&
      !ctx.primary.blocker &&
      ctx.primary.capacityMismatch
    ) {
      inhibited.push(kill(
        candidate,
        'capacity_mismatch',
        'You reported this mission does not fit your current capacity.',
      ))
      continue
    }

    // 5. A parked mission cannot quietly displace an active Primary. That
    //    is a priority challenge, and it requires stating what changed.
    if (candidate.kind === 'promote_to_primary' && ctx.primary) {
      inhibited.push(kill(
        candidate,
        'displaces_primary',
        `“${ctx.primary.title}” is already Primary. Replacing it needs a priority challenge, not a silent swap.`,
      ))
      continue
    }

    // 6. A mission with no finish line has no end state to move toward.
    if (candidate.kind === 'set_finish_line' && ctx.primary) {
      inhibited.push(kill(
        candidate,
        'no_finish_line',
        'No finish line, and a Primary mission is already active — this is not the constraint right now.',
      ))
      continue
    }

    surviving.push(candidate)
  }

  // 7. Among what is left, only the highest-leverage move survives.
  //    Everything else is real, just not first.
  const ranked = surviving.slice().sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  const [winner, ...rest] = ranked

  for (const loser of rest) {
    inhibited.push(kill(loser, 'lower_leverage', 'Lower leverage than the selected move right now.'))
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
        : ctx.primary.capacityMismatch
        ? `“${ctx.primary.title}” is Primary and reported as not fitting current capacity`
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

function describeWouldChange(
  situation: DeltaSituation,
  ctx: DeltaContext,
  targetClauseIndex: number | null = null,
  clauseTexts: string[] = [],
): string {
  // A move aimed at one clause changes on causes specific to that clause,
  // not on mission-level causes that don't actually bear on it — evidence
  // landing on the mission overall, or the mission itself getting blocked,
  // are still true triggers, but "this clause is now resolved" and "you
  // correct this specific operation" are the ones this move actually turns
  // on. Only reachable when targeting a clause, so `clauseTexts[targetClauseIndex]`
  // is always in range here.
  if (targetClauseIndex !== null && clauseTexts[targetClauseIndex]) {
    return `Evidence lands specifically against “${clauseTexts[targetClauseIndex]}”, or you correct this operation and I try another operation for the same unresolved target.`
  }
  switch (situation) {
    case 'evidence_conflict':
      return 'One source is confirmed and the disagreement resolves.'
    case 'primary_blocked':
      return ctx.secondary
        ? `The blocker clears, or you report that it needs someone else — then “${ctx.secondary.title}” becomes the move.`
        : 'The blocker clears, or you report that it needs someone else.'
    case 'primary_capacity_mismatch':
      // Nothing un-reports a capacity mismatch, so this doesn't "clear" the
      // way a blocker does — it changes only when Primary itself changes.
      return `You make something else Primary, or “${ctx.primary?.title ?? 'the Primary'}” is completed, paused, or abandoned.`
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

function describeBecause(
  situation: DeltaSituation,
  ctx: DeltaContext,
  winner?: DeltaCandidate,
  rejectedOperations = 0,
): string {
  // When the move is a concrete operation for one clause of the finish
  // line, the useful explanation is which clause it targets and why that
  // one — not why the mission matters in general.
  if (winner?.kind === 'model_suggested' && winner.missionId) {
    const owner = [ctx.primary, ctx.secondary].find(m => m?.id === winner.missionId)
    const total = decomposeFinishLine(owner?.finishLine ?? null).length
    const targeted = rejectedOperations > 0
      ? `you rejected ${rejectedOperations === 1 ? 'one earlier operation' : `${rejectedOperations} earlier operations`} for the first target, so this is another attempt at that same unresolved condition`
      : 'no trusted state says the first target is resolved, so this aims there'
    return `Your finish line names ${total} things to prove, and ${targeted}.`
  }
  if (winner?.kind === 'name_evidence') {
    return 'This mission completes on evidence, and no evidence requirement is set — so there is nothing yet that could prove it done.'
  }
  if (winner?.kind === 'produce_evidence') {
    return 'The finish line does not break into smaller parts, so the next real step is the proof it already asks for.'
  }
  switch (situation) {
    case 'evidence_conflict':
      return 'Two sources disagree about this mission. Nothing built on top of that is trustworthy until it is resolved.'
    case 'primary_blocked':
      return `“${ctx.primary?.title ?? 'The Primary mission'}” is the outcome that matters, and this blocker is the only thing standing between it and progress.`
    case 'primary_capacity_mismatch':
      return `You reported “${ctx.primary?.title ?? 'the Primary'}” doesn't fit your current capacity, and that report is what makes the Secondary actionable right now.`
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

  // What the finish line claims to prove and which operation rejections were
  // recorded against each target. Rejections remain attached to their target
  // for provenance, but never count as proof that the target is resolved.
  // Prefer whichever mission actually won (a blocked Primary's own
  // clear_blocker candidate still aims at Primary, correctly). Only when
  // nothing won does it matter whose clauses to name — and there, a
  // deferred Primary (blocked, or a reported capacity mismatch) means the
  // Secondary is what's actually in play, so the honest fallback should
  // name the Secondary's unresolved part, not the mission that can't win.
  const winnerMission = winner
    ? [ctx.primary, ctx.secondary].find(m => m?.id === winner.missionId) ?? null
    : null
  const primaryDeferred = Boolean(ctx.primary && (ctx.primary.blocker || ctx.primary.capacityMismatch))
  const aimedAt =
    winnerMission ?? (primaryDeferred ? ctx.secondary ?? ctx.primary : ctx.primary ?? ctx.secondary) ?? null
  const clauseTexts = decomposeFinishLine(aimedAt?.finishLine ?? null)
  const winnerTarget = winner?.kind === 'model_suggested' ? parseClauseId(winner.targetId) : null
  const targetClauseIndex = winner
    ? winnerTarget?.index ?? null
    : clauseTexts.length > 0
      ? 0
      : null

  const proofSteps: DeltaProofStep[] = clauseTexts.map((text, index) => ({
    index,
    text,
    rejectedOperations: aimedAt
      ? ctx.corrections.filter(c => candidateTargetsClause(c.candidateId, clauseId(aimedAt.id, index))).length
      : 0,
    selected: targetClauseIndex === index,
  }))
  const targetRejections = targetClauseIndex === null
    ? 0
    : proofSteps[targetClauseIndex]?.rejectedOperations ?? 0

  if (!winner) {
    const hadCandidates = candidates.length > 0
    // A blanket "was anything corrected" check is only honest here, in the
    // no-clause-sequence case (single-clause finish line, or blocked with
    // its clear_blocker candidate corrected) — there's at most one or two
    // structural candidates, so the check can't conflate distinct clauses.
    const structuralCorrected = clauseTexts.length === 0 && inhibited.some(c => c.reason === 'corrected')
    // Real state exists and names something unresolved, but no structural
    // signal (blocker, evidence, a model suggestion) could turn it into an
    // operation. This is the engine's own limit, not missing input from
    // the human — so it says so, rather than asking them to report a
    // change they never made.
    const clauseNeedsOperation = clauseTexts.length > 0 && targetClauseIndex !== null

    const move = !hadCandidates
      ? INSUFFICIENT_CONTEXT_MOVE
      : clauseNeedsOperation
      ? `I can see “${clauseTexts[targetClauseIndex as number]}” is still unresolved, but I can't derive the concrete step for it from your mission state alone.`
      : structuralCorrected
      ? `Tell me what would actually move “${aimedAt?.title ?? 'this mission'}” forward.`
      : `Name the evidence that will prove “${aimedAt?.title ?? 'this mission'}” is genuinely done.`

    const because = !hadCandidates
      ? describeBecause(situation, ctx)
      : clauseNeedsOperation
      ? targetRejections > 0
        ? `Your finish line names ${clauseTexts.length} things to prove. You rejected ${targetRejections === 1 ? 'one operation' : `${targetRejections} operations`} for this first unresolved target, but nothing in the mission, blocker, or evidence state yet supports a better one.`
        : `Your finish line names ${clauseTexts.length} things to prove, and this is the first. Nothing in the mission, blocker, or evidence state tells me the concrete step for it.`
      : structuralCorrected
      ? 'You corrected the only structural signal I had for this mission, and I don’t have another angle on it from mission, blocker, or evidence state alone.'
      : 'I can see the outcome, but I could not turn this finish line into a step smaller than itself. That is my limit, not missing information from you.'

    return {
      move,
      candidateId: clauseNeedsOperation ? clauseId(aimedAt!.id, targetClauseIndex as number) : null,
      provenance: 'insufficient_context',
      situation,
      // A real mission is in view whenever there was anything to generate
      // candidates from at all — even though nothing survived, the caller
      // (the model-assist fetch, in particular) still needs to know which
      // mission and clause this honest state is about. Only the truly
      // empty case (no mission at all) has none to name.
      missionId: hadCandidates && aimedAt ? aimedAt.id : null,
      missionTitle: hadCandidates && aimedAt ? aimedAt.title : null,
      because,
      currentReality: describeReality(ctx),
      blockingGap: !hadCandidates
        ? 'No mission names an outcome and a finish line.'
        : clauseNeedsOperation
        ? 'No concrete operation could be derived for this part of your finish line.'
        : structuralCorrected
        ? 'The only candidate this mission had was corrected.'
        : 'No part of the finish line is smaller than the finish line.',
      evidenceState,
      inhibited,
      wouldChangeIf: clauseNeedsOperation
        ? `You tell me the concrete step yourself, evidence lands specifically against “${clauseTexts[targetClauseIndex as number]}”, or you correct an attempted operation and I try another for this same unresolved target.`
        : describeWouldChange(situation, ctx),
      assembledFrom,
      proofSteps,
      computedAt: ctx.now,
    }
  }

  const mission =
    [ctx.primary, ctx.secondary, ...ctx.parked].find(m => m?.id === winner.missionId) ?? null

  return {
    move: winner.move,
    candidateId: winner.id,
    provenance: winner.kind === 'model_suggested' ? 'model' : 'deterministic',
    situation,
    missionId: winner.missionId,
    missionTitle: mission?.title ?? null,
    because: describeBecause(situation, ctx, winner, targetRejections),
    currentReality: describeReality(ctx),
    blockingGap: ctx.primary?.blocker ?? null,
    evidenceState,
    inhibited,
    wouldChangeIf: describeWouldChange(situation, ctx, targetClauseIndex, clauseTexts),
    assembledFrom,
    proofSteps,
    computedAt: ctx.now,
  }
}

/** Convenience: assemble and select in one call. */
export function predictStrategicDelta(
  missions: Mission[],
  evidence: EvidenceRecord[],
  corrections: DeltaCorrection[],
  now: string,
  suggestedOperations: DeltaCandidate[] = [],
): StrategicDelta {
  return selectStrategicDelta(assembleDeltaContext(missions, evidence, corrections, now, suggestedOperations))
}
