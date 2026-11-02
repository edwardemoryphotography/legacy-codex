/** A bounded excerpt of the actual answer, never a second generated claim. */
export function homeTakeaway(answer: string): string {
  const parts = answer.trim().split(/\n\s*\n/)
  const paragraph = (parts.find(part => part.trim() && !/^#{1,6} [^\n]+$/.test(part.trim())) ?? parts[0] ?? '').replace(/\s+/g, ' ').trim()
  if (paragraph.length <= 220) return paragraph
  const sentence = paragraph.match(/^.{30,219}?[.!?](?:\s|$)/)?.[0]?.trim()
  if (sentence) return sentence
  const boundary = paragraph.lastIndexOf(' ', 217)
  return `${paragraph.slice(0, boundary > 100 ? boundary : 217).trimEnd()}…`
}
