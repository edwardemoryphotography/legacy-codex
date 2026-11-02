export type HomeTool = 'brief' | 'triage' | 'ask' | 'prompt'
export const QUESTION_LIMIT = 400
const PROMPT_HELP = 'Help me write a clear, specific prompt an AI can act on, for this: '
export const PROMPT_LIMIT = QUESTION_LIMIT - PROMPT_HELP.length
export function promptHelpQuestion(text: string) {
  return PROMPT_HELP + text.slice(0, PROMPT_LIMIT)
}

/** Text is intent. A text-free tool never silently consumes a question. */
export function homeRequest(tool: HomeTool | null, text: string): { mode: 'question' | 'daily_brief' | 'triage'; question?: string; label: string } {
  const question = text.trim()
  if (tool === 'prompt' && question) return { mode: 'question', question: promptHelpQuestion(question), label: 'Prompt help' }
  if (question) return { mode: 'question', question, label: 'Ask Codex' }
  if (tool === 'brief') return { mode: 'daily_brief', label: 'Daily Brief' }
  if (tool === 'triage') return { mode: 'triage', label: 'Triage' }
  return { mode: 'question', question: '', label: 'Ask Codex' }
}

/** Keep the selected Primary inside the same bounded, aligned context roster. */
export function homeMissionRoster<T extends { id: string; state: string }>(missions: T[]): T[] {
  const primary = missions.find(mission => mission.state === 'primary')
  return (primary ? [primary, ...missions.filter(mission => mission.id !== primary.id)] : missions).slice(0, 40)
}
