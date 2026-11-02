export type ConversationTier = 'routine' | 'deep'

/** Missing preferences never put an ordinary question on the expensive tier.
 * Explicit specialist operations retain their existing defaults. */
export function briefModelTier(mode: string, requested: unknown): ConversationTier | null {
  if (requested === 'routine' || requested === 'deep') return requested
  if (requested !== undefined) return null
  return mode === 'architect' || mode === 'unblock' ? 'deep' : 'routine'
}
