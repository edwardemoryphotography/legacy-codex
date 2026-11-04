export interface ParsedVoiceAnswer {
  text: string
  actionTitle: string | null
}

/**
 * The live-voice directive asks the model to end with one machine-readable
 * action line. If it does not, do not invent a commitment from prose: the
 * caller shows the answer without a save control.
 */
export function parseVoiceAction(raw: string): ParsedVoiceAnswer {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let actionTitle: string | null = null
  const kept: string[] = []
  for (const line of lines) {
    const match = line.match(/^\s*NEXT ACTION:\s*(.*?)\s*$/i)
    if (!match) { kept.push(line); continue }
    const value = match[1].trim()
    if (!actionTitle && value && !/^none$/i.test(value)) actionTitle = value.slice(0, 240)
  }
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), actionTitle }
}
