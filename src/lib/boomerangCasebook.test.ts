import { describe, expect, it } from 'vitest'
import { BOOMERANG_CASES, renderBoomerangCasebook } from './boomerangCasebook'

// This test uses the real authored source corpus, not fabricated lessons or accounts.
describe('historical Boomerang Casebook provenance contract', () => {
  it('preserves the recovered public-safe corpus with stable, unique identifiers', () => {
    expect(BOOMERANG_CASES).toHaveLength(34)
    expect(new Set(BOOMERANG_CASES.map(record => record.id)).size).toBe(BOOMERANG_CASES.length)
    expect(BOOMERANG_CASES.every(record => /^BR-\d{3}$/.test(record.id))).toBe(true)
  })

  it('requires a full structural bridge, limits and at least one traceable source', () => {
    for (const record of BOOMERANG_CASES) {
      for (const field of ['title', 'era', 'sourceDomain', 'targetDomain', 'sharedStructure',
        'reasoningBridge', 'practicalConsequence', 'evidenceRequired'] as const) {
        expect(record[field].trim().length, `${record.id} missing ${field}`).toBeGreaterThan(8)
      }
      expect(record.sources.length, `${record.id} missing provenance`).toBeGreaterThan(0)
      expect(record.inheritance).toBe('not-demonstrated')
      for (const source of record.sources) {
        expect(source.label.trim()).not.toBe('')
        if (source.access === 'restricted') expect(source.url).toBeUndefined()
        else {
          expect(source.access).toBe('public')
          expect(source.url).toMatch(/^https:\/\/github\.com\/edwardemoryphotography\//)
        }
      }
    }
  })

  it('makes the same real records accessible through existing Codex search and read view', () => {
    const markdown = renderBoomerangCasebook()
    for (const record of BOOMERANG_CASES) {
      expect(markdown).toContain(`## ${record.id} — ${record.title}`)
      expect(markdown).toContain(record.reasoningBridge)
    }
    expect(markdown).toContain('not a confirmed lesson')
    expect(markdown).toContain('2015–2017')
  })
})
