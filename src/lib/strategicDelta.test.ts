import { describe, expect, it } from 'vitest'
import type { DeltaCandidate, DeltaCorrection, EvidenceRecord, Mission, MissionState } from '@/types'
import {
  assembleDeltaContext,
  clauseId,
  decomposeFinishLine,
  isConcreteMove,
  generateCandidates,
  inhibit,
  predictStrategicDelta,
  routeSituation,
  summarizeEvidence,
} from './strategicDelta'

const NOW = '2026-09-01T12:00:00.000Z'

// A finish line that names more than one thing to prove. Several tests need
// this because a single-clause finish line has no part smaller than itself.
const COMPOUND = 'ships the change, verifies it in production, and records the evidence'

function mission(over: Partial<Mission> & { id: string; state: MissionState }): Mission {
  return {
    title: `Mission ${over.id}`,
    why: '',
    finishLine: null,
    evidenceRequirement: null,
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

function evidence(over: Partial<EvidenceRecord> & { id: string; missionId: string }): EvidenceRecord {
  return {
    source: 'github',
    kind: 'merged_pr',
    status: 'verified',
    claim: 'PR merged',
    observedAt: NOW,
    fetchedAt: NOW,
    ...over,
  }
}

function correction(over: Partial<DeltaCorrection> & { correctedMove: string }): DeltaCorrection {
  return {
    id: 'c1',
    missionId: 'm1',
    reason: 'Not available this week',
    createdAt: NOW,
    ...over,
  }
}

// A model-derived operation for one clause — what the async model stage
// hands the engine. Never fabricated by the engine itself; only ever
// supplied by the caller, exactly like this.
function suggestion(missionId: string, index: number, move: string): DeltaCandidate {
  return { id: clauseId(missionId, index), kind: 'model_suggested', move, missionId, rank: 0 }
}

describe('summarizeEvidence', () => {
  it('reports none for an empty set rather than guessing', () => {
    expect(summarizeEvidence([], NOW)).toBe('none')
  })

  it('treats an explicit conflict row as a conflict', () => {
    expect(summarizeEvidence([evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })], NOW)).toBe('conflict')
  })

  it('treats two sources disagreeing as a conflict even when neither row is flagged', () => {
    const state = summarizeEvidence(
      [
        evidence({ id: 'e1', missionId: 'm1', source: 'github', status: 'verified' }),
        evidence({ id: 'e2', missionId: 'm1', source: 'notion', status: 'unverified' }),
      ],
      NOW,
    )
    expect(state).toBe('conflict')
  })

  it('reports stale when the only record is older than the staleness window', () => {
    const old = evidence({ id: 'e1', missionId: 'm1', fetchedAt: '2026-08-01T00:00:00.000Z' })
    expect(summarizeEvidence([old], NOW)).toBe('stale')
  })
})

describe('routeSituation', () => {
  const cases: Array<[string, Mission[], EvidenceRecord[], string]> = [
    ['empty when there is no mission state at all', [], [], 'empty'],
    [
      'no_primary_unready when missions exist but none names a finish line',
      [mission({ id: 'm1', state: 'parked' })],
      [],
      'no_primary_unready',
    ],
    [
      'no_primary_ready when a parked mission already has a finish line',
      [mission({ id: 'm1', state: 'parked', finishLine: 'Shipped' })],
      [],
      'no_primary_ready',
    ],
    [
      'primary_active when a Primary is set and nothing blocks it',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' })],
      [],
      'primary_active',
    ],
    [
      'primary_blocked when the Primary carries a blocker',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped', blocker: 'Waiting on Vaughn' })],
      [],
      'primary_blocked',
    ],
    [
      'evidence_conflict outranks a blocker — unverified state is the prior gate',
      [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped', blocker: 'Waiting on Vaughn' })],
      [evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })],
      'evidence_conflict',
    ],
  ]

  it.each(cases)('routes to %s', (_name, missions, ev, expected) => {
    expect(routeSituation(assembleDeltaContext(missions, ev, [], NOW))).toBe(expected)
  })
})

describe('inhibition', () => {
  it('kills advancing a blocked Primary, and names the blocker as the reason', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: COMPOUND, blocker: 'Waiting on Vaughn' })]
    // A blocked mission still gets any model-suggested operation on its own
    // clauses — and that too must be inhibited for the blocker, not selected.
    const ctx = assembleDeltaContext(missions, [], [], NOW, [suggestion('m1', 0, 'Send the change for review')])
    const { inhibited } = inhibit(generateCandidates(ctx), ctx)

    const killed = inhibited.find(c => c.id === clauseId('m1', 0))
    expect(killed?.reason).toBe('blocked')
    expect(killed?.explanation).toContain('Waiting on Vaughn')
  })

  it('kills a model-suggested operation that still only restates the mission', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship the redesign', finishLine: COMPOUND })]
    // A bad model output — the same template failure, just model-sourced.
    const ctx = assembleDeltaContext(missions, [], [], NOW, [suggestion('m1', 0, 'Continue advancing the redesign')])
    const { surviving, inhibited } = inhibit(generateCandidates(ctx), ctx)

    expect(surviving.some(c => c.id === clauseId('m1', 0))).toBe(false)
    expect(inhibited.find(c => c.id === clauseId('m1', 0))?.reason).toBe('not_a_move')
  })

  it('refuses to let a parked mission silently displace an active Primary', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' }),
      mission({ id: 'm2', state: 'parked', finishLine: 'Also shipped' }),
    ]
    const ctx = assembleDeltaContext(missions, [], [], NOW)
    const { inhibited } = inhibit(generateCandidates(ctx), ctx)

    const killed = inhibited.find(c => c.id === 'promote:m2')
    expect(killed?.reason).toBe('displaces_primary')
    expect(killed?.explanation).toContain('priority challenge')
  })

  it('kills every non-reconciling move while two sources disagree', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' })]
    const ev = [evidence({ id: 'e1', missionId: 'm1', status: 'conflict' })]
    const ctx = assembleDeltaContext(missions, ev, [], NOW)
    const { surviving, inhibited } = inhibit(generateCandidates(ctx), ctx)

    expect(surviving[0].id).toBe('reconcile:m1')
    expect(inhibited.every(c => c.id !== 'reconcile:m1')).toBe(true)
    expect(inhibited.some(c => c.reason === 'unverified_state')).toBe(true)
  })

  it('leaves exactly one surviving move', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', finishLine: 'Shipped' }),
      mission({ id: 'm2', state: 'parked', finishLine: 'Later' }),
      mission({ id: 'm3', state: 'parked' }),
    ]
    const ctx = assembleDeltaContext(missions, [], [], NOW)
    expect(inhibit(generateCandidates(ctx), ctx).surviving).toHaveLength(1)
  })
})

describe('predictStrategicDelta', () => {
  it('returns insufficient_context — not a guess — when there is no state to predict from', () => {
    const delta = predictStrategicDelta([], [], [], NOW)

    expect(delta.provenance).toBe('insufficient_context')
    expect(delta.situation).toBe('empty')
    expect(delta.missionId).toBeNull()
    // The empty state must still name the one missing input, not apologise.
    expect(delta.move).toContain('finish line')
    expect(delta.blockingGap).not.toBeNull()
  })

  // Round 2 of the real product test: an active Primary with a compound
  // finish line and no model stage wired up must NOT reach for a
  // clause-paraphrase template — it must honestly say it cannot derive the
  // operation, naming which clause. This is the failure the second real
  // test exposed: a proof target ("this part is unresolved") is not itself
  // a move.
  it('names the unresolved clause honestly rather than templating "Verify: <clause>" when no operation can be derived', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship the Delta', finishLine: COMPOUND })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.provenance).toBe('insufficient_context')
    // Which mission this honest state is about is still known — needed by
    // the model-assist stage to ground its one call, and by "Not right" to
    // record a correction that actually anchors to this clause.
    expect(delta.missionId).toBe('m1')
    expect(delta.move).toContain('ships the change')
    expect(delta.move).not.toMatch(/^Verify (this|that|it)/i)
    expect(delta.move).not.toContain('records the evidence')
    expect(delta.candidateId).toBe(clauseId('m1', 0))
    const step0 = delta.proofSteps.find(s => s.index === 0)
    expect(step0?.selected).toBe(true)
  })

  // Once the model stage (or any caller) supplies a real operation for that
  // same clause, the engine selects it — still gated by the same
  // isConcreteMove/inhibition every deterministic candidate runs through —
  // and labels it honestly as model-derived, not deterministic.
  it('selects a supplied operation for the unresolved clause and labels it model-derived', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship the Delta', finishLine: COMPOUND })]
    const delta = predictStrategicDelta(missions, [], [], NOW, [
      suggestion('m1', 0, 'Open a PR with the change and request review'),
    ])

    expect(delta.provenance).toBe('model')
    expect(delta.move).toBe('Open a PR with the change and request review')
    expect(delta.missionId).toBe('m1')
    expect(delta.proofSteps.find(s => s.index === 0)?.selected).toBe(true)
  })

  it('predicts clearing the blocker over any clause on the Secondary, and keeps the Secondary paraphrase visible as rejected', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: COMPOUND }),
    ]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.move).toContain('Clear what')
    expect(delta.blockingGap).toBe('Waiting on Vaughn')
    // The Secondary's own paraphrase is still visible as considered and
    // rejected — on quality grounds, since nothing blocks the Secondary.
    const alternative = delta.inhibited.find(c => c.id === 'advance:m2')
    expect(alternative?.reason).toBe('not_a_move')
    expect(delta.wouldChangeIf).toContain('Write the docs')
  })

  it('promotes the most recently worked ready mission when nothing is Primary', () => {
    const missions = [
      mission({ id: 'old', state: 'parked', title: 'Older', finishLine: 'Done', updatedAt: '2026-08-01T00:00:00.000Z' }),
      mission({ id: 'new', state: 'parked', title: 'Newer', finishLine: 'Done', updatedAt: '2026-08-30T00:00:00.000Z' }),
    ]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.missionId).toBe('new')
    expect(delta.move).toContain('Primary Mission')
  })

  it('asks for a finish line when missions exist but none names an end state', () => {
    const missions = [mission({ id: 'm1', state: 'parked', title: 'Vague idea' })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.provenance).toBe('deterministic')
    expect(delta.move).toContain('exact finish line')
  })

  // §15 — correction is a first-class interaction: clearing the blocker
  // must stop being recommended once corrected, and the Secondary's own
  // clause takes over — the same walk-forward the clause pipeline uses.
  it('stops recommending a corrected move and surfaces the next-best one instead', () => {
    const missions = [
      mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live', blocker: 'Waiting on Vaughn' }),
      mission({ id: 'm2', state: 'secondary', title: 'Write the docs', finishLine: COMPOUND }),
    ]
    const first = predictStrategicDelta(missions, [], [], NOW)
    const corrections = [correction({ correctedMove: first.move, reason: 'Vaughn is out; Beau is available' })]
    const second = predictStrategicDelta(missions, [], corrections, NOW)

    expect(second.move).not.toBe(first.move)
    const recorded = second.inhibited.find(c => c.move === first.move)
    expect(recorded?.reason).toBe('corrected')
    expect(recorded?.explanation).toContain('Beau is available')
  })

  it('falls back to insufficient_context — never a guess — once the only structural candidate is corrected', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship it', finishLine: 'Live' })]
    const first = predictStrategicDelta(missions, [], [], NOW)
    const delta = predictStrategicDelta(missions, [], [correction({ correctedMove: first.move })], NOW)

    expect(delta.provenance).toBe('insufficient_context')
    // It must name the specific thing it is missing, not ask the human to
    // report an external change they never made.
    expect(delta.move).not.toContain('what changed')
    expect(delta.because).toContain("only structural signal")
  })

  // The actual round-2 bug: correcting a clause-targeted move must walk to
  // the next clause, never collapse to "add what changed" while real,
  // untouched clauses remain.
  it('walks to the next clause — not to "add what changed" — when a clause-targeted move is corrected', () => {
    const missions = [mission({ id: 'm1', state: 'primary', title: 'Ship the Delta', finishLine: COMPOUND })]
    const first = predictStrategicDelta(missions, [], [], NOW)
    expect(first.candidateId).toBe(clauseId('m1', 0))

    const second = predictStrategicDelta(
      missions,
      [],
      [correction({ missionId: 'm1', correctedMove: first.move, candidateId: first.candidateId ?? undefined, reason: 'already shipped' })],
      NOW,
    )

    expect(second.provenance).toBe('insufficient_context')
    expect(second.candidateId).toBe(clauseId('m1', 1))
    expect(second.move).toContain('verifies it in production')
    expect(second.move).not.toContain('what changed')
    expect(second.proofSteps.find(s => s.index === 0)?.corrected).toBe(true)
    expect(second.proofSteps.find(s => s.index === 1)?.selected).toBe(true)
  })

  it('reports what it assembled from as counts, making no claim it cannot support', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Live' })]
    const delta = predictStrategicDelta(missions, [], [], NOW)

    expect(delta.assembledFrom).toContain('1 Primary mission')
    expect(delta.assembledFrom).toContain('0 evidence records')
  })

  it('is pure — the same state at the same instant yields the same prediction', () => {
    const missions = [mission({ id: 'm1', state: 'primary', finishLine: 'Live' })]
    expect(predictStrategicDelta(missions, [], [], NOW)).toEqual(predictStrategicDelta(missions, [], [], NOW))
  })
})

// ─── Regression: the first two real product tests ───────────────────────
// Round 1 (1 September 2026): Strategic Delta handed back the destination
// restated. Edward corrected it; the engine had generated exactly one
// candidate, so correcting it left nothing, and the engine asked him to
// report an external change he never made.
//
// Round 2, on the SAME real Mission after that fix: the engine now walked
// the finish line into clauses, but handed one back verbatim as though
// naming the unresolved clause were itself the move — "Verify this part of
// your finish line: 'Strategic Delta gives me one useful recommendation
// without prompting'" is a proof target, not an operation. These are his
// real strings, used as fixtures. Nothing here is written to Supabase.
describe('regression — the real Strategic Delta failed twice', () => {
  const REAL_TITLE = 'Prove whether Legacy Codex can genuinely tell me what matters next from real state.'
  const REAL_FINISH =
    'Strategic Delta gives me one useful recommendation without prompting, explains why, accepts one real correction, recomputes, and preserves that correction after reload.'
  const REAL_PARAPHRASE = `Move “${REAL_TITLE}” toward: ${REAL_FINISH}`
  const REAL_CORRECTION =
    'This is not a next move. It restates my Mission and finish line instead of identifying one concrete action I can take now to advance it.'
  // The exact round-2 failure: naming the clause was mistaken for the move.
  const CLAUSE_ONE = 'Strategic Delta gives me one useful recommendation without prompting'
  const ROUND_2_BAD_MOVES = [
    `Verify this part of your finish line: “${CLAUSE_ONE}”`,
    'Verify that it explains why.',
    'Verify that it accepts one correction.',
    'Verify that it recomputes.',
  ]

  const real = () => [mission({ id: 'real', state: 'primary', title: REAL_TITLE, finishLine: REAL_FINISH })]

  it('never selects the whole-mission paraphrase, and shows it was rejected as not a move', () => {
    const delta = predictStrategicDelta(real(), [], [], NOW)

    expect(delta.move).not.toBe(REAL_PARAPHRASE)
    const rejected = delta.inhibited.find(c => c.move === REAL_PARAPHRASE)
    expect(rejected?.reason).toBe('not_a_move')
  })

  // The round-2 bar, stated as a disjunction rather than one sentence: the
  // engine must land on a real operation, or on the honest "I can't derive
  // this" state — and never on a clause-naming template either way.
  it('either selects a concrete operation or is honest that it cannot derive one — never a clause-naming template', () => {
    const delta = predictStrategicDelta(real(), [], [], NOW)

    expect(ROUND_2_BAD_MOVES).not.toContain(delta.move)
    expect(delta.move).not.toMatch(/^Verify (this|that|it)\b/i)

    if (delta.provenance === 'deterministic' || delta.provenance === 'model') {
      const [primary] = real()
      expect(isConcreteMove(delta.move, primary)).toBe(true)
    } else {
      expect(delta.provenance).toBe('insufficient_context')
      // Honest, not evasive: it must still say which clause, not "add what
      // changed" — and there must be something real left to correct toward.
      expect(delta.candidateId).toBe(clauseId('real', 0))
    }
  })

  it('never carries the whole finish line as the move', () => {
    const delta = predictStrategicDelta(real(), [], [], NOW)
    expect(delta.move).not.toContain(REAL_FINISH)
  })

  // Round 1's actual bug: this used to collapse to "Add what changed" once
  // the sole candidate was corrected.
  it('regenerates from the same external state after his round-1 correction, rather than collapsing to "add what changed"', () => {
    const corrections = [
      correction({ missionId: 'real', correctedMove: REAL_PARAPHRASE, reason: REAL_CORRECTION }),
    ]
    const delta = predictStrategicDelta(real(), [], corrections, NOW)

    // Round-1's whole-mission paraphrase is still the only *candidate*
    // that was corrected — so the engine has no structural or model
    // candidate to select, and the clause pipeline (round 2's mechanism)
    // takes over, naming the first unresolved clause honestly.
    expect(delta.provenance).toBe('insufficient_context')
    expect(delta.candidateId).toBe(clauseId('real', 0))
    expect(ROUND_2_BAD_MOVES).not.toContain(delta.move)
    // His round-1 correction is still attributed to him, not to the quality bar.
    expect(delta.inhibited.find(c => c.move === REAL_PARAPHRASE)?.reason).toBe('corrected')
  })

  it('walks to a different, uncorrected clause each time he corrects', () => {
    const targets: (string | null)[] = []
    let corrections = [correction({ missionId: 'real', correctedMove: REAL_PARAPHRASE, reason: REAL_CORRECTION })]

    for (let i = 0; i < 3; i += 1) {
      const delta = predictStrategicDelta(real(), [], corrections, NOW)
      targets.push(delta.candidateId)
      expect(ROUND_2_BAD_MOVES).not.toContain(delta.move)
      corrections = [
        ...corrections,
        correction({
          id: `c${i}`,
          missionId: 'real',
          correctedMove: delta.move,
          candidateId: delta.candidateId ?? undefined,
          reason: 'already proven',
        }),
      ]
    }

    expect(new Set(targets).size).toBe(3)
    expect(targets).toEqual([clauseId('real', 0), clauseId('real', 1), clauseId('real', 2)])
  })

  it('exposes the finish line as the sequence of proofs it is, aimed at the first clause', () => {
    const delta = predictStrategicDelta(real(), [], [], NOW)

    expect(delta.proofSteps.length).toBe(5)
    expect(delta.proofSteps.filter(step => step.selected)).toHaveLength(1)
    expect(delta.proofSteps[0].selected).toBe(true)
    expect(delta.proofSteps.map(step => step.text)).toContain('preserves that correction after reload')
  })

  // Given a real operation for the first clause — what the model stage
  // would supply — the engine selects it, honestly labeled, still gated by
  // the same quality bar as everything deterministic.
  it('selects a supplied operation for the first clause when one is available, and still rejects a bad one', () => {
    const good = predictStrategicDelta(real(), [], [], NOW, [
      suggestion('real', 0, 'Ask Vaughn to test the live Delta and report back within a day'),
    ])
    expect(good.provenance).toBe('model')
    expect(good.move).toBe('Ask Vaughn to test the live Delta and report back within a day')

    const bad = predictStrategicDelta(real(), [], [], NOW, [
      suggestion('real', 0, 'Verify this part of your finish line'),
    ])
    expect(bad.provenance).not.toBe('model')
    expect(ROUND_2_BAD_MOVES).not.toContain(bad.move)
  })
})

describe('isConcreteMove', () => {
  const m = { title: 'Ship the redesign', finishLine: 'the new page is live for everyone' }

  it.each([
    'Move “Ship the redesign” toward: the new page is live for everyone',
    'Advance the redesign',
    'Work on shipping the redesign',
    'Continue toward the new page',
    'Make progress on the redesign',
    // The round-2 failure shape: naming that a check should happen, using
    // only this app's own scaffolding words, is not naming an operation.
    // (Edward's actual round-2 strings — "Verify that it explains why.",
    // "Verify that it recomputes." — are only meaningfully templated
    // *against his real mission*, whose finish line contains "explains"/
    // "recomputes"; that scoping is exercised in the regression block
    // below, not here against an unrelated fixture mission.)
    'Verify this part of your finish line: “the new page is live”',
    'Check this part of the mission',
  ])('rejects %s as a restatement rather than a move', move => {
    expect(isConcreteMove(move, m)).toBe(false)
  })

  it.each([
    'Reload the app and verify the correction survived',
    'Call Beau and schedule the test',
    'Compare the two deployment states',
    // Vacuous/template verbs are fine once something concrete rides along.
    'Advance the redesign by sending the draft to the reviewer',
    'Verify the redesign by asking three real users to try it',
  ])('accepts %s as a real move', move => {
    expect(isConcreteMove(move, m)).toBe(true)
  })

  it('does not depend on a phrase list — an unseen restatement still fails', () => {
    expect(isConcreteMove('Ship the redesign so the new page is live for everyone', m)).toBe(false)
  })

  it('is not fooled by a morphological variant of the mission\'s own word', () => {
    expect(isConcreteMove('Work on shipping the redesign', m)).toBe(false)
  })
})

describe('decomposeFinishLine', () => {
  it('splits a sequence of proofs into its parts, keeping the human\'s words', () => {
    expect(decomposeFinishLine('ships the change, verifies it, and records the evidence')).toEqual([
      'ships the change',
      'verifies it',
      'records the evidence',
    ])
  })

  it('returns nothing when the finish line has no smaller part than itself', () => {
    expect(decomposeFinishLine('the new page is live')).toEqual([])
    expect(decomposeFinishLine(null)).toEqual([])
  })
})
