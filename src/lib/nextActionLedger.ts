import type { Mission } from '@/types'
import type { AcceptanceSnapshot } from './nextAction'

export interface LedgerAcceptance {
  move: string
  /** The finish line in force when it was accepted; absent on older rows. */
  finishLine?: string
  candidateId?: string
  contextKey?: string
  eventId?: string
  createdAt?: string
}

export interface LedgerEvent {
  id: string
  mission_id: string
  type?: string
  detail: string
  created_at: string
}

function acceptanceFromDetail(detail: string, row?: Pick<LedgerEvent, 'id' | 'created_at'>): LedgerAcceptance | null {
  try {
    const parsed: unknown = JSON.parse(detail)
    if (parsed && typeof parsed === 'object' && typeof (parsed as { move?: unknown }).move === 'string') {
      const { move, finishLine, candidateId, contextKey } = parsed as {
        move: string
        finishLine?: unknown
        candidateId?: unknown
        contextKey?: unknown
      }
      if (!move.trim()) return null
      return {
        move,
        ...(typeof finishLine === 'string' ? { finishLine } : {}),
        ...(typeof candidateId === 'string' ? { candidateId } : {}),
        ...(typeof contextKey === 'string' ? { contextKey } : {}),
        ...(row?.id ? { eventId: row.id } : {}),
        ...(row?.created_at ? { createdAt: row.created_at } : {}),
      }
    }
  } catch {
    // Plain prose — the older format.
  }
  return detail.trim()
    ? {
        move: detail,
        ...(row?.id ? { eventId: row.id } : {}),
        ...(row?.created_at ? { createdAt: row.created_at } : {}),
      }
    : null
}

// Events that change what the Delta is predicting for a mission. A later one
// means an earlier acceptance was agreement with a prediction that has since
// been replaced, so it must not come back as "Accepted" after reload.
// finish_line_set covers older acceptance rows that did not record their
// finish line (the only in-app way to change a finish line writes it).
const INVALIDATES_ACCEPTANCE = new Set([
  'delta_corrected',
  'delta_step_supplied',
  'delta_assistance_generated',
  'finish_line_set',
])

/** mission id → the latest acceptance still standing in the event ledger:
 *  the newest delta_accepted per mission, unless a correction, supplied step
 *  or finish-line change for that mission came after it. */
export function acceptanceLedger(rows: LedgerEvent[]): Record<string, LedgerAcceptance> {
  const live: Record<string, LedgerAcceptance> = {}
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of ordered) {
    if (row.type === 'delta_accepted') {
      const acceptance = acceptanceFromDetail(row.detail, row)
      if (acceptance) live[row.mission_id] = acceptance
    } else if (row.type && INVALIDATES_ACCEPTANCE.has(row.type)) {
      delete live[row.mission_id]
    }
  }
  return live
}

/** mission id → accepted move, dropping any acceptance recorded under a
 *  finish line the mission no longer has (a revision made outside this
 *  screen writes no event this session saw). */
export function currentAcceptances(
  ledger: Record<string, LedgerAcceptance>,
  missions?: Record<string, Pick<Mission, 'finishLine'>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [missionId, acceptance] of Object.entries(ledger)) {
    const mission = missions?.[missionId]
    if (missions && acceptance.finishLine !== undefined && mission?.finishLine !== acceptance.finishLine) continue
    out[missionId] = acceptance.move
  }
  return out
}

/** Ledger fold and finish-line check in one step. The UI still shows
 *  "Accepted" only when the move equals the Delta it is displaying. */
export function liveAcceptances(
  rows: LedgerEvent[],
  missions?: Record<string, Pick<Mission, 'finishLine'>>,
): Record<string, string> {
  return currentAcceptances(acceptanceLedger(rows), missions)
}

/** The shared account-scoped acceptance projection used by Home and Brief. */
export function latestAcceptance(
  rows: LedgerEvent[],
  mission: Pick<Mission, 'id' | 'finishLine'>,
): AcceptanceSnapshot | null {
  const acceptance = acceptanceLedger(rows)[mission.id]
  if (!acceptance) return null
  if (acceptance.finishLine !== undefined && acceptance.finishLine !== mission.finishLine) return null
  return {
    eventId: acceptance.eventId ?? `${mission.id}:accepted`,
    missionId: mission.id,
    move: acceptance.move,
    ...(acceptance.candidateId ? { candidateId: acceptance.candidateId } : {}),
    ...(acceptance.finishLine !== undefined ? { finishLine: acceptance.finishLine } : {}),
    ...(acceptance.contextKey ? { contextKey: acceptance.contextKey } : {}),
    ...(acceptance.createdAt ? { createdAt: acceptance.createdAt } : {}),
  }
}
