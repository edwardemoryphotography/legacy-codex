import { describe, expect, it } from 'vitest'
import { humanizeSourceText, reviewProvenanceSummary, sourceKindLabel } from './readableProvenance'
import type { ProjectReview, ProjectSource } from './projectReview'

const sources: ProjectSource[] = [
  { id: 'mission:f58a32e2-edc0-488b-b56a-3e8ccd32aa33', label: 'Ship the print store', kind: 'mission', status: 'human-defined outcome', text: '{}' },
  { id: 'action:11111111-2222-3333-4444-555555555555', label: 'Upload three prints', kind: 'commitment', status: 'human-reported commitment', text: '{}' },
  { id: 'lesson:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'Verify original constraint before reversing', kind: 'lesson', status: 'Human-confirmed operating rule', text: '{}' },
]

describe('humanizeSourceText', () => {
  it('replaces raw prefixed source IDs with readable source labels', () => {
    const raw = 'Based on mission:f58a32e2-edc0-488b-b56a-3e8ccd32aa33 and action:11111111-2222-3333-4444-555555555555, continue the upload.'
    const result = humanizeSourceText(raw, sources)
    expect(result).toContain('“Ship the print store”')
    expect(result).toContain('“Upload three prints”')
    expect(result).not.toMatch(/f58a32e2|11111111/)
  })

  it('marks an unknown source ID as unverified instead of presenting it as a supplied source', () => {
    const result = humanizeSourceText('See event:99999999-8888-7777-6666-555555555555 for details.', sources)
    expect(result).toBe('See an unverified source reference for details.')
  })

  it('marks an unknown bare UUID as unverified', () => {
    const result = humanizeSourceText('See 99999999-8888-7777-6666-555555555555 for details.', sources)
    expect(result).toBe('See an unverified reference for details.')
  })

  it('replaces bare UUIDs that match known supplied sources', () => {
    const result = humanizeSourceText('Applies to f58a32e2-edc0-488b-b56a-3e8ccd32aa33 directly.', sources)
    expect(result).toBe('Applies to “Ship the print store” directly.')
  })
})

describe('reviewProvenanceSummary', () => {
  it('exposes only honest recorded tier, pass mode, provider/model, and cited lessons', () => {
    const review: ProjectReview = {
      tier: 'routine',
      critique: 'single_pass',
      provider: 'gemini',
      model: 'gemini-4-hydrogen',
      elapsedMs: 16_382,
      missionId: 'f58a32e2-edc0-488b-b56a-3e8ccd32aa33',
      finishLine: 'One print sold',
      operation: 'Publish the three print listings',
      decision: 'act',
      finishWhen: 'Listings are live on the store URL',
      clarification: null,
      resumeActionId: null,
      alternatives: [],
      biggerPicture: 'Launch store',
      why: 'Smallest direct step',
      overlooked: 'None',
      selfCheck: 'Grounded',
      unknowns: [],
      sourceIds: [sources[0].id, sources[2].id],
      sources,
      contextKey: 'a'.repeat(64),
      reviewedAt: '2026-11-24T23:50:00Z',
      cached: false,
      warnings: [],
      lesson: null,
    }
    const summary = reviewProvenanceSummary(review)
    expect(summary.tierLabel).toBe('Economy')
    expect(summary.passLabel).toBe('Single structured pass')
    expect(summary.selectionBasis).toBe('Economy default')
    expect(summary.intelligenceLabel).toBe('Gemini · gemini-4-hydrogen')
    expect(summary.elapsedLabel).toBe('16.4s')
    expect(summary.sourcesSummary).toBe('2 of 3 supplied sources cited')
    expect(summary.citedLessons).toHaveLength(1)
    expect(summary.executionUnknown).toBe(true)
    expect(summary.policyLabel).toBe('Selection policy not recorded for this older review')
    expect(summary.citedLessonNote).toBe('Lessons cited as context; influence not demonstrated')
    expect(sourceKindLabel('lesson')).toBe('Confirmed lesson')
  })

  it('reports tier, static policy, actual participants, fallbacks and measured interval', () => {
    const review = {
      tier: 'deep' as const, critique: 'independent' as const, provider: 'anthropic' as const, model: 'claude-opus-5-5',
      elapsedMs: 21_000,
      execution: {
        tier: 'deep' as const, selectionPolicy: 'static_measured_v1' as const,
        provider: 'anthropic' as const, model: 'claude-opus-5-5',
        fallbacks: [{ provider: 'gemini' as const, model: 'gemini-4-argon', reason: 'timed_out' }],
        draft: { provider: 'anthropic' as const, model: 'claude-opus-5-5' },
        critique: { provider: 'anthropic' as const, model: 'claude-opus-5-5' },
        elapsedMs: 21_000, elapsedBasis: 'after_context_assembly_to_review_built' as const,
      },
      missionId: sources[0].id.slice(8), finishLine: 'One print sold', operation: 'Publish listings',
      decision: 'act' as const, finishWhen: 'Live', clarification: null, resumeActionId: null,
      alternatives: [], biggerPicture: 'Launch', why: 'Direct', overlooked: 'None', selfCheck: 'Grounded',
      unknowns: [], sourceIds: [sources[0].id], sources: [sources[0]], contextKey: 'a'.repeat(64),
      reviewedAt: '2026-11-24T23:50:00Z', cached: false, warnings: [], lesson: null,
    } as unknown as ProjectReview
    const summary = reviewProvenanceSummary(review)
    expect(summary.selectionBasis).toBe('User selected Deep')
    expect(summary.policyLabel).toBe('Static measured selection — not learned routing')
    expect(summary.intelligenceLabel).toBe('Claude · claude-opus-5-5')
    expect(summary.fallbackLabel).toBe('Fallback used: Gemini (timed_out)')
    expect(summary.participantsLabel).toBe('Draft: Claude · claude-opus-5-5 · Critique: Claude · claude-opus-5-5')
    expect(summary.elapsedBasisLabel).toBe('after context assembly, to review built')
    expect(summary.executionUnknown).toBe(false)
  })

  it('omits provider/model cleanly when absent on an older cached record', () => {
    const review: ProjectReview = {
      missionId: 'f58a32e2-edc0-488b-b56a-3e8ccd32aa33',
      finishLine: 'One print sold',
      operation: 'Publish listings',
      decision: 'act',
      finishWhen: 'Live',
      clarification: null,
      resumeActionId: null,
      alternatives: [],
      biggerPicture: 'Launch',
      why: 'Direct',
      overlooked: 'None',
      selfCheck: 'Grounded',
      unknowns: [],
      sourceIds: [sources[0].id],
      sources: [sources[0]],
      contextKey: 'a'.repeat(64),
      reviewedAt: '2026-11-24T23:50:00Z',
      cached: true,
      warnings: [],
      lesson: null,
    }
    const summary = reviewProvenanceSummary(review)
    expect(summary.tierLabel).toBeNull()
    expect(summary.passLabel).toBeNull()
    expect(summary.selectionBasis).toBeNull()
    expect(summary.intelligenceLabel).toBeNull()
    expect(summary.elapsedLabel).toBeNull()
    expect(summary.cached).toBe(true)
  })
})
