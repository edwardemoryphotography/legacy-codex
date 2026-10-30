import { describe, expect, it } from 'vitest'
import { promptHelpQuestion } from './HomeTab'

describe('promptHelpQuestion', () => {
  it('stays within the 400-character question limit /api/brief enforces', () => {
    expect(promptHelpQuestion('x'.repeat(1000)).length).toBe(400)
  })

  it('keeps the person’s words after the instruction', () => {
    expect(promptHelpQuestion('plan a night shoot')).toMatch(/plan a night shoot$/)
  })
})
