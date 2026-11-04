import { describe, expect, it } from 'vitest'
import { parseVoiceAction } from './liveVoiceAction'

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
