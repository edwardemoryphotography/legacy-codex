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

  it('falls back to a plain kind phrase for an unknown source ID', () => {
    const result = humanizeSourceText('See event:99999999-8888-7777-6666-555555555555 for details.', sources)
    expect(result).toBe('See your saved note for details.')
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
    expect(summary.intelligenceLabel).toBe('Gemini · gemini-4-hydrogen')
    expect(summary.sourcesSummary).toBe('2 of 3 supplied sources cited')
    expect(summary.citedLessons).toHaveLength(1)
    expect(sourceKindLabel('lesson')).toBe('Confirmed lesson')
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
    expect(summary.intelligenceLabel).toBeNull()
    expect(summary.cached).toBe(true)
  })
})
