import { describe, expect, it } from 'vitest'
import { getAllEntries } from '@/data/codex'
import { homeTakeaway } from './homeTakeaway'

describe('Home answer excerpt', () => {
  it('bounds existing canonical source text without inventing a takeaway', () => {
    for (const { content } of getAllEntries()) {
      const excerpt = homeTakeaway(content)
      expect(excerpt.length).toBeLessThanOrEqual(220)
      const words: string[] = content.match(/[\p{L}\p{N}]+/gu) ?? []
      let cursor = 0
      for (const word of excerpt.match(/[\p{L}\p{N}]+/gu) ?? []) {
        const index = words.indexOf(word, cursor)
        expect(index).toBeGreaterThanOrEqual(cursor)
        cursor = index + 1
      }
    }
  })
  it('preserves the authentic observed triage response', () => {
    const answer = 'There are no blocked missions to triage at this time. If you have a specific issue or topic you’d like to address, feel free to reach out with more details.'
    expect(homeTakeaway(answer)).toBe(answer)
  })
  it('has no content to invent for an empty answer', () => {
    expect(homeTakeaway('  ')).toBe('')
  })
})

it('shows readable words instead of Markdown delimiters from the recorded flow', () => {
  expect(homeTakeaway('**Yes, we can continue.** Read [your project](https://example.test).')).toBe('Yes, we can continue. Read your project.')
})
