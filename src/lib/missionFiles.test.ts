import { describe, expect, it } from 'vitest'
import { missionFileInstruction } from './missionFiles'

describe('missionFileInstruction', () => {
  it('names the mission and finish line and keeps the Unknown rule', () => {
    const text = missionFileInstruction({ title: 'Finish research paper', finishLine: '3 pages submitted' })
    expect(text).toContain('Finish research paper')
    expect(text).toContain('3 pages submitted')
    expect(text).toMatch(/Write Unknown where the files are silent\.$/)
  })

  it('stays within the 400-character route clamp so the rules are never cut off', () => {
    const text = missionFileInstruction({ title: 't'.repeat(900), finishLine: 'f'.repeat(900) })
    expect(text.length).toBeLessThanOrEqual(400)
    expect(text).toMatch(/Write Unknown where the files are silent\.$/)
  })

  it('says the finish line is not saved instead of inventing one', () => {
    expect(missionFileInstruction({ title: 'Paper', finishLine: null })).toContain('Finish line: "not saved"')
  })
})
