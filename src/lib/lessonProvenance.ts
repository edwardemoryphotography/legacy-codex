// Workflow provenance, not evidence of useful learning. Project Review has
// always used lesson:confirm:<sha256>; other writers have separate namespaces.
// Read on reload so existing records need no backfill. Missing provenance
// stays unknown: a mission association or an absent origin field is insufficient.
export function hasProjectReviewOrigin(origin: unknown, idempotencyKey: unknown): boolean {
  return (origin === undefined || origin === 'project_review') &&
    typeof idempotencyKey === 'string' && /^lesson:confirm:[a-f0-9]{64}$/.test(idempotencyKey)
}
