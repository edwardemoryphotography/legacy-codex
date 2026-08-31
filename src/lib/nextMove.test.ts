import { describe, expect, it } from 'vitest'
import { recommendNextMove } from './nextMove'

describe('recommendNextMove', () => {
  it('routes implementation work to the build lane', () => {
    const result = recommendNextMove('Fix the mobile frontend and run the build')
    expect(result.lane).toBe('build')
    expect(result.source).toBe('doctrine')
  })

  it('routes release work to the ship lane', () => {
    const result = recommendNextMove('Deploy the merged commit to Vercel and verify the live URL')
    expect(result.lane).toBe('ship')
    expect(result.evidenceNeeded).toContain('Merged commit')
  })

  it('falls back to clarifying the finish line when no lane matches', () => {
    expect(recommendNextMove('something fuzzy').lane).toBe('structure')
  })

  it('preserves mission context in the builder handoff', () => {
    const result = recommendNextMove('I am blocked and need to continue', {
      title: 'Consolidate Legacy Codex',
      finishLine: 'One canonical live product',
    })
    expect(result.handoff).toContain('Mission: Consolidate Legacy Codex')
    expect(result.handoff).toContain('Finish line: One canonical live product')
  })
})
