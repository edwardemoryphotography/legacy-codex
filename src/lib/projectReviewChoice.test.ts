import { describe, expect, it } from 'vitest'
import { parseProjectReview, type ProjectSource } from './projectReview'

// Protocol fixtures exercise rejection/ownership rules only. They are not
// provider responses, real missions, or evidence of recommendation quality.
const sources: ProjectSource[] = [
  { id: 'mission:m1', kind: 'mission', label: 'Target', status: 'human-defined', text: '{}' },
  { id: 'action:a1', kind: 'commitment', label: 'Existing action', status: 'human-reported', text: '{}',
    commitment: { id: 'a1', missionId: 'm1', status: 'TODO', actionTitle: 'Open the saved checklist and complete its next unchecked item' } },
]
const proposal = {
  decision: 'resume', operation: 'Open the saved checklist and complete its next unchecked item',
  finishWhen: 'The next unchecked item has a recorded result.', clarification: null, resumeActionId: 'a1',
  biggerPicture: 'Finish the existing commitment.', why: 'Continuing the open action avoids starting a duplicate.',
  overlooked: 'No other dependency is supported.', selfCheck: 'A changed requirement could invalidate the checklist.',
  unknowns: [], sourceIds: ['mission:m1', 'action:a1'], lesson: null,
  alternatives: [{ operation: 'Write a new checklist', whyNot: 'The existing one is unfinished.', sourceIds: ['action:a1'] }],
}
const parse = (overrides = {}, context = sources) => parseProjectReview(JSON.stringify({ ...proposal, ...overrides }), context, 'm1')

describe('review choice contract', () => {
  it('rejects a resume operation that names different work from its canonical action', () => {
    expect(parse({ operation: 'Email the print lab and request a new quote' })).toBeNull()
  })
  it('rejects a resume source without its authenticated action title', () => {
    const untitled = sources.map(s => s.commitment ? { ...s, commitment: { id: 'a1', missionId: 'm1', status: 'TODO' } } : s)
    expect(parse({}, untitled)).toBeNull()
  })
  it('never truncates or paraphrases a commitment to fit the resume contract', () => {
    for (const actionTitle of ['', '   ', 'x'.repeat(241)]) {
      const context = sources.map(s => s.commitment ? { ...s, commitment: { ...s.commitment, actionTitle } } : s)
      expect(parse({}, context)).toBeNull()
    }
    expect(parse({ operation: 'Finish the next item on the checklist' })).toBeNull()
    expect(parse({ operation: `  ${proposal.operation}  ` })).not.toBeNull()
  })
  it('keeps an exact unfinished action link and observable finish condition', () => {
    expect(parse()).toMatchObject({ decision: 'resume', resumeActionId: 'a1', finishWhen: proposal.finishWhen })
    const active = sources.map(s => s.commitment ? { ...s, commitment: { ...s.commitment, status: 'IN_PROGRESS' } } : s)
    expect(parse({}, active)).not.toBeNull()
  })
  it('rejects completed, foreign, absent or untyped resume targets', () => {
    const valid = sources[1].commitment!
    for (const commitment of [undefined, { ...valid, status: 'DONE' },
      { ...valid, missionId: 'm2' }, { ...valid, id: 'a2' }]) {
      expect(parse({}, sources.map(s => s.kind === 'commitment' ? { ...s, commitment } : s))).toBeNull()
    }
    expect(parse({ resumeActionId: 'missing' })).toBeNull()
    expect(parse({ sourceIds: ['mission:m1'] })).toBeNull()
  })
  it('accepts a complete canonical title at the exact operation bound', () => {
    const operation = 'x'.repeat(240)
    const context = sources.map(s => s.commitment ? { ...s, commitment: { ...s.commitment, actionTitle: operation } } : s)
    expect(parse({ operation }, context)?.operation).toBe(operation)
  })
  it('requires target mission and real citations for the winner and alternatives', () => {
    expect(parse({ sourceIds: ['action:a1'] })).toBeNull()
    expect(parse({ sourceIds: ['mission:m1', 'missing'] })).toBeNull()
    expect(parse({ alternatives: [{ ...proposal.alternatives[0], sourceIds: ['missing'] }] })).toBeNull()
    expect(parse({ alternatives: [{ ...proposal.alternatives[0], operation: proposal.operation }] })).toBeNull()
  })
  it('rejects actionable output without a bounded finish condition or with conflicting fields', () => {
    for (const finishWhen of [null, '', ' '.repeat(10), 'x'.repeat(301)]) expect(parse({ finishWhen })).toBeNull()
    expect(parse({ decision: 'act' })).toBeNull() // new work cannot carry a resume ID
    expect(parse({ clarification: 'Which checklist?' })).toBeNull()
    expect(parse({ why: 'x'.repeat(501) })).toBeNull()
  })
  it('accepts one deciding question only with no action or finish claim', () => {
    const question = { decision: 'clarify', operation: null, resumeActionId: null, finishWhen: null,
      clarification: 'Does the saved checklist still match the required outcome?', alternatives: [] }
    expect(parse(question)).toMatchObject(question)
    expect(parse({ ...question, operation: proposal.operation })).toBeNull()
    expect(parse({ ...question, clarification: null })).toBeNull()
    expect(parse({ ...question, finishWhen: proposal.finishWhen })).toBeNull()
  })
  it('does not promote legacy or truncated output into the new contract', () => {
    const old = { ...proposal, decision: undefined, finishWhen: undefined, alternatives: undefined }
    expect(parse(old)).toBeNull()
    expect(parseProjectReview(JSON.stringify(proposal).slice(0, -3), sources, 'm1')).toBeNull()
  })
})
