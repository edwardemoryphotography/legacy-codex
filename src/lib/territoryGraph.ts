// Pure, deterministic graph model for the Territory Graph view. Every edge is
// a relationship that already exists in saved data, and carries the table and
// column it came from. No edge is inferred, and no two missions are linked:
// there is no stored, human-confirmed mission-to-mission link yet.
import { GROUP_OF_STATE, type MissionEventLite, type OpenAction, type TerritoryGroup } from './territory'
import type { Mission } from '@/types'

export interface EvidenceLite {
  id: string
  mission_id: string
  kind: string
  status: string
  claim: string
  observed_at: string
}

export type GraphNodeKind = 'mission' | 'action' | 'blocker' | 'lesson' | 'correction' | 'evidence'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  missionId: string
  label: string
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
  label: string
  provenance: string
}

export const PER_KIND_LIMIT = 3
const CELL = 340
const RING = 125
const GROUP_ORDER: TerritoryGroup[] = ['active', 'paused', 'completed', 'abandoned']

function parse(detail: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(detail)
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

export function buildTerritoryGraph(missions: Mission[], actions: OpenAction[], events: (MissionEventLite & { id?: string })[], evidence: EvidenceLite[]) {
  const ordered = [...missions].sort((a, b) =>
    GROUP_ORDER.indexOf(GROUP_OF_STATE[a.state]) - GROUP_ORDER.indexOf(GROUP_OF_STATE[b.state]) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  const columns = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(ordered.length))))
  const retired = new Set(events.filter(e => e.type === 'delta_lesson_retired').map(e => text(parse(e.detail)?.lessonId)).filter(Boolean))
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  ordered.forEach((mission, index) => {
    const cx = CELL / 2 + (index % columns) * CELL
    const cy = CELL / 2 + Math.floor(index / columns) * CELL
    nodes.push({ id: `mission:${mission.id}`, kind: 'mission', missionId: mission.id, label: mission.title || 'Untitled mission', x: cx, y: cy })

    const own = events.filter(e => e.mission_id === mission.id)
    const children: { id: string; kind: GraphNodeKind; label: string; edge: string; provenance: string }[] = []
    const action = actions.find(a => a.mission_id === mission.id)
    if (action) children.push({ id: `action:${action.id}`, kind: 'action', label: action.action_title, edge: 'unfinished action', provenance: 'actions.mission_id' })
    if (mission.blocker?.trim()) children.push({ id: `blocker:${mission.id}`, kind: 'blocker', label: mission.blocker, edge: 'blocker', provenance: 'missions.blocker' })
    own.filter(e => e.type === 'delta_lesson_confirmed' && !(e.id && retired.has(e.id))).slice(0, PER_KIND_LIMIT).forEach((e, i) => {
      const rule = text(parse(e.detail)?.rule)
      if (rule) children.push({ id: `lesson:${e.id ?? `${mission.id}:${i}`}`, kind: 'lesson', label: rule, edge: 'confirmed lesson', provenance: 'mission_events · delta_lesson_confirmed' })
    })
    own.filter(e => e.type === 'delta_corrected').slice(0, PER_KIND_LIMIT).forEach((e, i) => {
      const reason = text(parse(e.detail)?.reason) ?? text(parse(e.detail)?.move)
      if (reason) children.push({ id: `correction:${e.id ?? `${mission.id}:${i}`}`, kind: 'correction', label: reason, edge: 'correction', provenance: 'mission_events · delta_corrected' })
    })
    evidence.filter(e => e.mission_id === mission.id).slice(0, PER_KIND_LIMIT).forEach(e =>
      children.push({ id: `evidence:${e.id}`, kind: 'evidence', label: e.claim, edge: `evidence (${e.status})`, provenance: 'evidence_snapshots.mission_id' }))

    children.forEach((child, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / children.length
      nodes.push({ id: child.id, kind: child.kind, missionId: mission.id, label: child.label, x: Math.round(cx + RING * Math.cos(angle)), y: Math.round(cy + RING * Math.sin(angle)) })
      edges.push({ from: `mission:${mission.id}`, to: child.id, label: child.edge, provenance: child.provenance })
    })
  })

  const rows = Math.max(1, Math.ceil(ordered.length / columns))
  return { nodes, edges, width: columns * CELL, height: rows * CELL }
}
