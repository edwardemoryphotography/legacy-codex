import { describe, expect, it } from 'vitest'
import type { ProjectSource } from './projectReview'
import { compactEvidenceSources } from './reviewPacket'

function source(kind: ProjectSource['kind'], id: string, length: number): ProjectSource {
  return { id, kind, label: id, status: 'supplied', text: 'x'.repeat(length), truncated: false }
}

describe('compactEvidenceSources', () => {
  it('keeps every source kind while bounding counts and total size', () => {
    const sources: ProjectSource[] = [
      source('mission', 'm', 5_000),
      source('commitment', 'c1', 3_000), source('commitment', 'c2', 3_000), source('commitment', 'c3', 3_000),
      source('correction', 'k', 3_000), source('evidence', 'e', 3_000), source('lesson', 'l', 3_000),
      source('human_note', 'n', 3_000), source('repository', 'r', 3_000),
    ]
    const { sources: out, droppedLessons } = compactEvidenceSources(sources, 12_000)
    expect(droppedLessons).toBe(1)
    const kinds = new Set(out.map(item => item.kind))
    expect(kinds).toEqual(new Set(['mission', 'commitment', 'correction', 'evidence', 'human_note', 'repository']))
    expect(out.filter(item => item.kind === 'commitment').length).toBe(2)
    expect(out.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(12_000)
    expect(out[0]?.text.length).toBeLessThan(5_000)
  })

  it('does not reorder or invent ids', () => {
    const sources = [source('mission', 'a', 100), source('mission', 'b', 100)]
    const { sources: out } = compactEvidenceSources(sources)
    expect(out.map(item => item.id)).toEqual(['a'])
  })
})
