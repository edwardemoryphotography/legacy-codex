// Input contracts are shared with the server; no model or account data here.
export function assistanceQuestion(title: string): string {
  return /paper|essay|research/i.test(title)
    ? 'What is the assignment or topic, and what have you written so far?'
    : 'What do you have so far, and what would you like help with next?'
}

export function parseAssistanceNote(body: { contextNote?: unknown; requestId?: unknown }): { note: string; requestId: string } | null | undefined {
  if (body.contextNote === undefined && body.requestId === undefined) return undefined
  if (typeof body.contextNote !== 'string' || !body.contextNote.trim() || body.contextNote.length > 6_000 ||
      typeof body.requestId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.requestId)) return null
  return { note: body.contextNote.trim(), requestId: body.requestId }
}

export function draftStartingPoint(review: { workDraft?: string | null; finishWhen?: string | null } | null): string | null {
  if (!review?.workDraft) return null
  return `Model-generated draft — check before using.\n\n${review.workDraft}${review.finishWhen ? `\n\nNext step finishes when: ${review.finishWhen}` : ''}`
}
