// POC for improved Codex search (spike for feature #2)
// Lightweight ranking without external deps or embeddings
// Scores: title exact > title partial > content word overlap

import type { CodexEntry, CodexSection } from '@/types'
import { flattenEntries } from '@/data/codex'

export interface ScoredEntry {
  entry: CodexEntry
  score: number
  matchedTerms: string[]
}

export function rankEntries(
  query: string,
  sections: CodexSection[]
): ScoredEntry[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const terms = trimmed.split(/\s+/).filter(Boolean)

  const scored: ScoredEntry[] = []

  for (const section of sections) {
    const entries = flattenEntries(section.entries)
    for (const entry of entries) {
      let score = 0
      const matchedTerms: string[] = []

      const titleLower = entry.title.toLowerCase()
      const contentLower = entry.content.toLowerCase()

      // Title exact match
      if (titleLower === trimmed) {
        score += 100
        matchedTerms.push('title:exact')
      } else if (titleLower.includes(trimmed)) {
        score += 50
        matchedTerms.push('title:partial')
      }

      // Word overlap in title and content
      let overlap = 0
      for (const term of terms) {
        if (titleLower.includes(term)) {
          overlap += 3
          matchedTerms.push(`title:${term}`)
        }
        if (contentLower.includes(term)) {
          overlap += 1
          matchedTerms.push(`content:${term}`)
        }
      }
      score += overlap

      if (score > 0) {
        scored.push({ entry, score, matchedTerms: Array.from(new Set(matchedTerms)) })
      }
    }
  }

  // Sort by score desc, then title
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.entry.title.localeCompare(b.entry.title)
  })
}

