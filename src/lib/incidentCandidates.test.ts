/** @vitest-environment node */
// Integrity checks on the real authored records. No synthetic incidents,
// accounts or confirmations are created here.
import { describe, expect, it } from 'vitest'
import { BOOMERANG_CASES, renderBoomerangRecord } from './boomerangCasebook'
import { EVIDENCE_LAYER_LABELS, INCIDENT_CANDIDATES, casebookEvidenceLayers, mechanismPrecondition } from './incidentCandidates'
import { formatLearnedContext } from './learnedContext'
import { relatedProjectSignal } from './projectReview'

describe('real incident candidates', () => {
  it('ties every candidate to an existing casebook case and to public sources for each attempt', () => {
    for (const candidate of INCIDENT_CANDIDATES) {
      expect(BOOMERANG_CASES.some(record => record.id === candidate.casebookId)).toBe(true)
      for (const attempt of candidate.attempts) {
        const source = candidate.sources.find(item => item.id === attempt.sourceId)
        expect(source?.url).toMatch(/^https:\/\/github\.com\/edwardemoryphotography\/legacy-codex\/pull\/\d+$/)
        expect(Number.isFinite(Date.parse(attempt.observedAt))).toBe(true)
      }
      expect(candidate.exceptions.length).toBeLessThanOrEqual(800)
      expect(candidate.whenToApply.length).toBeLessThanOrEqual(500)
      expect(candidate.contradictions.length).toBeGreaterThan(0)
      expect(candidate.competingExplanations.length).toBeGreaterThan(0)
      expect(candidate.layers.independentFutureTransfer).toBe('Not demonstrated.')
    }
  })

  it('keeps six separate evidence layers on all recovered cases and never claims transfer', () => {
    for (const record of BOOMERANG_CASES) {
      const layers = casebookEvidenceLayers(record)
      expect(Object.keys(layers).sort()).toEqual(Object.keys(EVIDENCE_LAYER_LABELS).sort())
      expect(layers.independentFutureTransfer).toBe('Not demonstrated.')
      if (record.recordStatus !== 'user-verified-fix') expect(layers.userVerifiedIncident).toBe('None recorded.')
    }
    const shown = renderBoomerangRecord(BOOMERANG_CASES.find(record => record.id === 'BR-034')!)
    expect(shown).toContain('Incident candidate IC-001')
    expect(shown).toContain('proposed lesson, not confirmed')
    expect(shown).not.toMatch(/confidence: \d/i)
  })
})

describe('structural precondition for repeated-local-fix-failure', () => {
  it('needs repeated attempts, not a single failure or a blocker alone', () => {
    const check = (corrections: number, suppliedSteps: number, hasBlocker: boolean) =>
      mechanismPrecondition('repeated-local-fix-failure', { corrections, suppliedSteps, hasBlocker }).observed
    expect(check(0, 0, false)).toBe(false)
    expect(check(1, 0, false)).toBe(false)
    expect(check(0, 5, false)).toBe(false) // steps without a blocker are ordinary progress
    expect(check(0, 0, true)).toBe(false)  // a blocker with no attempts is not repetition
    expect(check(2, 0, false)).toBe(true)
    expect(check(1, 2, true)).toBe(true)
  })

  it('shows why word overlap is the wrong test, on the real incident text', () => {
    const incident = INCIDENT_CANDIDATES[0]
    const text = `${incident.problem} ${incident.rootMechanism} ${incident.proposedRule}`
    // Real repository sentence (AGENTS.md, deployment gate): same mechanism, different words.
    const sameMechanism = { id: 'agents-deployment-gate', title: 'Deployment / environment sanity gate', why: 'Repeated Supabase/Vercel configuration rediscovery is a system failure.', finish_line: null }
    // Real repository sentence (STATE.md, 2026-11-02): shared iPhone words, one change, no repetition.
    const sharedWordsOnly = { id: 'state-home-icons', title: 'Home Screen icons are static metadata assets', why: 'Physical iPhone rendering remains a separate check; never clear browser data or remove an existing Home Screen app to refresh its icon.', finish_line: null }
    const lexicalMiss = relatedProjectSignal(text, sameMechanism).score
    const lexicalFalsePositive = relatedProjectSignal(text, sharedWordsOnly).score
    // Observed on 2026-11-10 with the unchanged scorer. One pair each; not a benchmark of scale.
    expect(lexicalMiss).toBe(1)             // below the selection threshold of 2: the same mechanism is missed
    expect(lexicalFalsePositive).toBe(4)    // selected on home, screen, iphone, browser: unrelated mechanism
  })
})

describe('learned context keeps exceptions with the rule', () => {
  it('supplies an incident rule with its exceptions and omits them for other rules', () => {
    const incident = INCIDENT_CANDIDATES[0]
    const base = { id: 'a', missionId: 'm', scope: 'account' as const, confirmedAt: '2026-11-10T00:00:00Z', reviewedAt: '2026-11-10T00:00:00Z',
      rule: incident.proposedRule, whenToApply: incident.whenToApply, sourceIds: ['s'], sourceRefs: [{ id: 's', label: 'PR', status: 'Merged' }] }
    const withExceptions = formatLearnedContext([{ ...base, origin: 'incident', candidateId: incident.id, mechanism: incident.mechanism, exceptions: incident.exceptions }], [])
    expect(withExceptions).toContain(JSON.stringify(incident.exceptions).slice(1, -1))
    expect(formatLearnedContext([base], [])).not.toContain('"exceptions"')
  })
})
