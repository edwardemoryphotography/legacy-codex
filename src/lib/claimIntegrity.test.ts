import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { unsupportedOutcomeAssertions } from './claimIntegrity'

// Real, committed source prose. No invented provider outputs, model completions,
// evidence rows or user projects are used for these language-boundary checks.
const continuity = readFileSync('docs/verification/builder-continuity-2026-10-31.md', 'utf8')
const ownership = readFileSync('docs/architecture/data-ownership.md', 'utf8')

describe('review claim publication gate', () => {
  it('holds a documented assertion about CI success for authoritative evidence, even if a model repeats it', () => {
    const observed = continuity.split('\n').find(line => line.includes('passed every gate'))
    expect(observed).toBeDefined()
    // Remove Markdown link syntax; preserve the actual published words.
    const readable = observed!.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    expect(unsupportedOutcomeAssertions(readable)).not.toHaveLength(0)
  })

  it('does not turn an explicit limit on verification into an affirmative completion claim', () => {
    const observed = continuity.split('\n').find(line => line.includes('not a real person'))
    expect(observed).toBeDefined()
    expect(unsupportedOutcomeAssertions(observed!)).toHaveLength(0)
  })

  it('leaves the actual canonical ownership boundary intact', () => {
    const rule = ownership.split('\n').find(line => line.includes('Merged != Deployed'))
    expect(rule).toBeDefined()
    expect(unsupportedOutcomeAssertions(rule!)).toHaveLength(0)
  })

  it('does not treat an actual user-workflow limitation as a completed result', () => {
    const rule = continuity.split('\n').find(line => line.includes('No mission, action or lesson was submitted.'))
    expect(rule).toBeDefined()
    expect(unsupportedOutcomeAssertions(rule!)).toHaveLength(0)
  })
})
