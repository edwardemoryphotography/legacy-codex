/**
 * Presentation only. A historical saved action may wrap the entire mission
 * title inside a generic planning sentence. Remove only that EXACT wrapper
 * when displaying it; preserve the canonical action title and note verbatim.
 *
 * No heuristic rewriting, model calls, or database changes.
 */
export function savedActionDisplay(title: string, missionTitle: string): {
  heading: string
  fromNote: string | null
  original: string | null
} {
  const prefix = 'Outline the first concrete work block for “' + missionTitle + '” based on your note:'
  if (title.startsWith(prefix)) {
    const fromNote = title.slice(prefix.length).trim()
    if (fromNote) {
      return { heading: 'Outline the first concrete work block', fromNote, original: title }
    }
  }
  return { heading: title, fromNote: null, original: null }
}
