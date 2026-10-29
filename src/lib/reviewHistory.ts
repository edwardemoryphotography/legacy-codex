export interface HistoricalReview {
  reviewedAt: string
  finishLine: string
  operation: string | null
  sources: { id: string; label: string }[]
}

// This is display-only history, never a validated current recommendation.
export function historicalReview(detail: string, missionId: string): HistoricalReview | null {
  try {
    const value = JSON.parse(detail)
    if (value.missionId !== missionId || typeof value.reviewedAt !== 'string' || !Number.isFinite(Date.parse(value.reviewedAt)) || typeof value.finishLine !== 'string' || !(typeof value.operation === 'string' || value.operation === null) || !Array.isArray(value.sources) || !Array.isArray(value.sourceIds)) return null
    const sources = value.sources.filter((s: unknown): s is { id: string; label: string } => !!s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string' && typeof (s as { label?: unknown }).label === 'string' && value.sourceIds.includes((s as { id: string }).id)).map((s: { id: string; label: string }) => ({ id: s.id, label: s.label }))
    return { reviewedAt: value.reviewedAt, finishLine: value.finishLine, operation: value.operation, sources }
  } catch { return null }
}
