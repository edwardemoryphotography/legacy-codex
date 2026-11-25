// Builds the one instruction /api/analyze receives when a person attaches
// their own project files to a saved mission. The route clamps the
// instruction to 400 characters, so the mission text is clipped here first
// and the reading rules always survive.
import type { Mission } from '@/types'

export const MAX_INSTRUCTION = 400
// Must stay in sync with MAX_TOTAL_BYTES in src/app/api/analyze/route.ts.
export const MAX_ATTACH_BYTES = 4 * 1024 * 1024
export const ATTACH_ACCEPT = '.pdf,.txt,.md,.csv,.json,image/*'
export const HOME_ATTACH_ACCEPT = 'image/*,.heic,.heif,.pdf,.txt,.md,.csv,.json'
export const ACCEPTED_FILE_SUMMARY = 'PDF, text/Markdown/CSV/JSON, or JPEG/PNG/WebP/GIF/HEIC images'

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 100 * 1024 ? 0 : 1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const RULES = 'Read only these files. List: what the work is; stated requirements and limits (page/word counts, deadlines, required sections); where the draft stands; anything that conflicts with the finish line. Write Unknown where the files are silent.'

export function missionFileInstruction(mission: Pick<Mission, 'title' | 'finishLine'>): string {
  const budget = MAX_INSTRUCTION - RULES.length - ' Mission: "". Finish line: "".'.length
  const half = Math.max(0, Math.floor(budget / 2))
  const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value)
  const title = clip(mission.title.trim(), half)
  const finish = clip((mission.finishLine ?? 'not saved').trim(), budget - title.length)
  return `Mission: "${title}". Finish line: "${finish}". ${RULES}`
}
