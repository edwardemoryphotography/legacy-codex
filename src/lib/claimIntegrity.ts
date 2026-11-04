import type { ReviewProposal } from './projectReview'

// A narrow, deterministic publication gate: review context currently contains
// human reports, derived evidence snapshots and external excerpts, not a read
// from the canonical evidence_items authority. None of those sources authorizes
// a model to claim that a deploy, fix, test or human outcome is verified.
// This does NOT establish truth for statements that pass the gate.
const UNSUPPORTED_COMPLETION = [
  /\b(?:i|we)\s+(?:have\s+)?(?:verified|confirmed|tested|deployed|shipped|fixed|completed|inspected)\b/i,
  /\b(?:is|are|was|were)\s+(?:(?:now|already|fully|independently|successfully)\s+)*(?:verified|validated|deployed|shipped|fixed|completed|live)\b/i,
  /\b(?:has|have|had)\s+been\s+(?:(?:fully|independently|successfully)\s+)*(?:verified|validated|tested|deployed|shipped|fixed|completed)\b/i,
  /\b(?:CI|tests?|checks?|builds?|deployments?)\b(?:\s+[a-z0-9-]+){0,4}\s+(?:passed|succeeded)\b/i,
]

// Attribute reporting or explicitly negated assertions without treating them
// as the model itself claiming verification. Keep the gate conservative.
const REPORTED_OR_NEGATED = /\b(?:not|never|no|without|unverified|reportedly|reported|claimed|alleged|says|said)\b/i

export function unsupportedOutcomeAssertions(value: string): string[] {
  const results: string[] = []
  for (const sentence of value.split(/(?<=[.!?])\s+|[\n;]+/)) {
    for (const pattern of UNSUPPORTED_COMPLETION) {
      const match = pattern.exec(sentence)
      if (!match) continue
      const preceding = sentence.slice(Math.max(0, match.index - 42), match.index)
      if (!REPORTED_OR_NEGATED.test(preceding)) results.push(sentence.trim().slice(0, 240))
      break
    }
  }
  return results
}

type AuditableReview = Pick<ReviewProposal, 'biggerPicture' | 'why' | 'overlooked' | 'selfCheck' | 'unknowns' | 'alternatives'>

// Guard the model's *own* explanation, not a user's workDraft, an imperative
// next move or quoted source content. Call before persistence AND when restoring
// old cached reviews, so a cached proposal cannot bypass the publication gate.
export function unsupportedReviewAssertions(review: AuditableReview): string[] {
  const fields = [
    ['biggerPicture', review.biggerPicture],
    ['why', review.why],
    ['overlooked', review.overlooked],
    ['selfCheck', review.selfCheck],
    ...review.unknowns.map((value, index) => [`unknowns[${index}]`, value]),
    ...review.alternatives.map((value, index) => [`alternatives[${index}].whyNot`, value.whyNot]),
  ] as [string, string][]
  return fields.flatMap(([field, value]) =>
    unsupportedOutcomeAssertions(value).map(() => field))
}
