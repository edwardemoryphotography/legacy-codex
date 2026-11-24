import type { ProjectSource } from './projectReview'

/**
 * Economy packet compaction. Keeps every source kind but bounds how many and
 * how much text each contributes. It never invents, rewrites or reorders
 * evidence: the same downstream validation runs against exactly these sources.
 */
export function compactEvidenceSources(sources: ProjectSource[], budget = 12_000): ProjectSource[] {
  const limits: Partial<Record<ProjectSource['kind'], { count: number; chars: number }>> = {
    mission: { count: 1, chars: 2_600 }, commitment: { count: 2, chars: 1_200 },
    correction: { count: 3, chars: 1_400 }, evidence: { count: 3, chars: 1_200 },
    lesson: { count: 2, chars: 900 }, human_note: { count: 2, chars: 1_200 },
    repository: { count: 1, chars: 800 },
  }
  const used: Record<string, number> = {}
  const out: ProjectSource[] = []
  let total = 0
  for (const source of sources) {
    const limit = limits[source.kind]
    if (!limit) continue
    const seen = used[source.kind] ?? 0
    if (seen >= limit.count) continue
    const remaining = budget - total
    if (remaining <= 200) break
    const text = source.text.slice(0, Math.min(limit.chars, remaining))
    used[source.kind] = seen + 1
    total += text.length
    out.push({ ...source, text, truncated: Boolean(source.truncated || text.length < source.text.length) })
  }
  return out
}
