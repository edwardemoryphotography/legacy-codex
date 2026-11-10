import { describe, expect, it } from 'vitest'
import { BOOMERANG_CASES, renderBoomerangCasebook, renderBoomerangRecord } from './boomerangCasebook'
import { getAllEntries } from '@/data/codex'

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
  it('makes every recovered case independently searchable through existing Root navigation', () => {
    const entries = getAllEntries().filter(entry => entry.path.startsWith('root.boomerang-casebook.'))
    expect(entries).toHaveLength(BOOMERANG_CASES.length)
    for (const record of BOOMERANG_CASES) {
      const entry = entries.find(item => item.path.endsWith(record.id))
      expect(entry, record.id).toBeDefined()
      expect(entry?.title).toContain(record.title)
      expect(entry?.content).toContain(record.reasoningBridge)
      expect(entry?.content).toContain('Evidence still required')
      const result = renderBoomerangRecord(record)
      expect(result).toContain('\n\n**Source:**')
      expect(result).not.toContain('\\n\\n**Source:**')
    }
  })

})
