import { describe, expect, it } from 'vitest'
import { savedActionDisplay } from './savedActionDisplay'

// Both checks use verbatim existing action/mission records (Nov 19 read-only
// database inspection), not synthetic missions or placeholder actions.
const mission = 'Use Legacy Codex to guide, build, test, and continuously improve Legacy Codex itself, learning from real problems and carrying those lessons into future development.'
const savedTitle = 'Outline the first concrete work block for “' + mission + '” based on your note: I need to implement a file and document upload feature that I can click…'

describe('savedActionDisplay', () => {
  it('surfaces the actual saved note while preserving the full original wording', () => {
    const view = savedActionDisplay(savedTitle, mission)
    expect(view.heading).toBe('Outline the first concrete work block')
    expect(view.fromNote).toBe('I need to implement a file and document upload feature that I can click…')
    expect(view.original).toBe(savedTitle)
  })

  it('leaves another real saved action entirely unchanged', () => {
    const title = 'Fix the iPhone orb and keyboard layout'
    const view = savedActionDisplay(title, 'the design of this')
    expect(view).toEqual({ heading: title, fromNote: null, original: null })
  })
})
