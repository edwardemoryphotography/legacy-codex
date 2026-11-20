import { describe, expect, it } from 'vitest'
import { savedActionDisplay } from './savedActionDisplay'

// Exact observed title of the existing in-progress action (Nov 19 read-only
// check); not an invented example and not a substitute for the real UI check.
const mission = 'Use Legacy Codex to guide, build, test, and continuously improve Legacy Codex itself, learning from real problems and carrying those lessons into future development.'
const savedTitle = 'Outline the first concrete work block for “' + mission + '” based on your note: I need to implement a file and document upload feature that I can click…'

describe('savedActionDisplay', () => {
  it('surfaces the actual saved note while preserving the full original wording', () => {
    const view = savedActionDisplay(savedTitle, mission)
    expect(view.heading).toBe('Outline the first concrete work block')
    expect(view.fromNote).toBe('I need to implement a file and document upload feature that I can click…')
    expect(view.original).toBe(savedTitle)
  })

  it('does not change an action when its current mission is different', () => {
    const view = savedActionDisplay(savedTitle, mission.slice(0, -1))
    expect(view).toEqual({ heading: savedTitle, fromNote: null, original: null })
  })
})
