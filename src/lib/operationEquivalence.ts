// Conservative lexical equivalence, not arbitrary semantic matching. Preserve
// order, negations, numbers and objects so distinct work is not suppressed.
const variants: Record<string, string> = {
  checking: 'check', checked: 'check', reviewing: 'review', reviewed: 'review',
  verifying: 'verify', verified: 'verify', inspecting: 'inspect', inspected: 'inspect',
  opening: 'open', opened: 'open', running: 'run', ran: 'run', testing: 'test', tested: 'test',
}
function signature(text: string) {
  return (text.replace(/^please\s+/i, '').match(/[a-zA-Z0-9]+/g) ?? [])
    // Keep A/An/The identifiers. Only a lowercase internal 'the' is an article.
    .filter((word, index, words) => !(word === 'the' && index > 0 && index < words.length - 1))
    .map(word => word.toLowerCase()).map(word => variants[word] ?? word).join(' ')
}
export function operationsEquivalent(left: string, right: string): boolean {
  const key = signature(left)
  return Boolean(key) && key === signature(right)
}
