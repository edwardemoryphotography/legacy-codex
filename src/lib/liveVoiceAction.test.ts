import { describe, expect, it } from 'vitest'
import { extractFinishCondition, parseVoiceAction } from './liveVoiceAction'

describe('parseVoiceAction', () => {
  it('separates one concrete action from the full answer', () => {
    expect(parseVoiceAction('The real blocker is the unfinished export.\n\nNEXT ACTION: Open the export and run one missing test.')).toEqual({
      text: 'The real blocker is the unfinished export.',
      actionTitle: 'Open the export and run one missing test.',
    })
  })

  it('does not invent an action when the model says NONE', () => {
    expect(parseVoiceAction('There is not enough saved context yet.\n\nNEXT ACTION: NONE')).toEqual({
      text: 'There is not enough saved context yet.',
      actionTitle: null,
    })
  })

  it('keeps prose when no action line exists', () => {
    expect(parseVoiceAction('No structured line.')).toEqual({ text: 'No structured line.', actionTitle: null })
  })
})

describe('extractFinishCondition', () => {
  it('extracts an explicit finish condition when present without inventing one', () => {
    expect(extractFinishCondition('**Interpretation (proposed):** Narrow scope.\n\n**Finish when:** One verified order is placed.')).toBe(
      'One verified order is placed.',
    )
    expect(extractFinishCondition('No finish line stated here.')).toBeNull()
  })
})
