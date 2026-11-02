import { describe, expect, it } from 'vitest'
import { getAllEntries } from '@/data/codex'
import { homeTakeaway } from './homeTakeaway'

describe('Home answer excerpt', () => {
  it('bounds existing canonical source text without inventing a takeaway', () => {
    for (const { content } of getAllEntries()) {
      const excerpt = homeTakeaway(content)
      expect(excerpt.length).toBeLessThanOrEqual(220)
      expect(content.replace(/\s+/g, ' ')).toContain(excerpt.replace(/…$/, ''))
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
