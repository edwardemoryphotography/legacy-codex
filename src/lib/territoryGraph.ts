// Pure, deterministic graph model for the Territory Graph view. Every edge is
// a relationship that already exists in saved data, and carries the table and
// column it came from. No edge is inferred, and no two missions are linked:
// there is no stored, human-confirmed mission-to-mission link yet.
import { GROUP_OF_STATE, type MissionEventLite, type OpenAction, type TerritoryGroup } from './territory'
import { sortTerritoryEntities, type TerritoryEntity, type TerritorySignal } from './territoryEntities'
import { endpointNodeId, type TerritoryLink } from './territoryWorkspace'
import type { Mission, MissionState } from '@/types'

export interface EvidenceLite {
  id: string
  mission_id: string
  kind: string
  status: string
  claim: string
  observed_at: string
}

export type GraphNodeKind = 'mission' | 'action' | 'blocker' | 'lesson' | 'correction' | 'evidence' | 'project' | 'doctrine' | 'constraint'

export interface GraphNode {
  id: string
  kind: GraphNodeKind
  missionId: string
  label: string
  x: number
  y: number
  // Mission cards only: the saved state and finish line, shown on the card.
  state?: MissionState
  detail?: string | null
  // Territory entity cards only. They have no mission owner and no edges yet.
  entityId?: string
  signal?: TerritorySignal | null
  cluster?: string | null
}

export interface GraphEdge {
  from: string
  to: string
  label: string
  provenance: string
  kind?: 'saved' | 'relation'
}

export const PER_KIND_LIMIT = 3
// Children are drawn as CHILD boxes on a flattened ring around a MISSION card.
// Adjacent child centres at least CHILD_GAP apart cannot overlap, MIN_RING
// keeps side children clear of the card, and RING_Y flattens the ring so a
// stacked phone layout stays short. The overlap test checks the worst case.
export const MISSION_BOX = { w: 200, h: 72 }
export const ENTITY_BOX = { w: 200, h: 72 }
export const CHILD_BOX = { w: 112, h: 34 }
export const CHILD_GAP = 130
const MIN_RING = 170
const RING_Y = 0.7
const ringFor = (count: number) => (count < 2 ? MIN_RING : Math.max(MIN_RING, Math.ceil(CHILD_GAP / (2 * Math.sin(Math.PI / count)))))
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

export function buildTerritoryGraph(
  missions: Mission[],
  actions: OpenAction[],
  events: (MissionEventLite & { id?: string })[],
  evidence: EvidenceLite[],
  maxColumns = 3,
  entities: TerritoryEntity[] = [],
  territoryLinks: TerritoryLink[] = [],
) {
  const ordered = [...missions].sort((a, b) =>
    GROUP_ORDER.indexOf(GROUP_OF_STATE[a.state]) - GROUP_ORDER.indexOf(GROUP_OF_STATE[b.state]) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  const columns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(ordered.length))))
  const retired = new Set(events.filter(e => e.type === 'delta_lesson_retired').map(e => text(parse(e.detail)?.lessonId)).filter(Boolean))
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const PAD = 24
  const ENTITY_GAP = 24
  const ENTITY_SECTION_GAP = 36
  const ENTITY_COL_W = ENTITY_BOX.w + PAD * 2
  const entityList = sortTerritoryEntities(entities)

  // First-class non-mission entities sit above the mission rows. They have no
  // edges yet; Path 2 adds saved links, not inferred ones.
  const entityCols = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(entityList.length))))
  entityList.forEach((entity, index) => {
    const row = Math.floor(index / entityCols)
    const col = index % entityCols
    nodes.push({
      id: endpointNodeId('territory_node', entity.id),
      kind: entity.kind,
      missionId: '',
      entityId: entity.id,
      label: entity.label,
      x: PAD + ENTITY_BOX.w / 2 + col * ENTITY_COL_W,
      y: PAD + ENTITY_BOX.h / 2 + row * (ENTITY_BOX.h + ENTITY_GAP),
      signal: entity.signal,
      cluster: entity.cluster,
    })
  })
  const entityRows = Math.ceil(entityList.length / entityCols)
  const entityHeight = entityList.length
    ? PAD + entityRows * (ENTITY_BOX.h + ENTITY_GAP) - ENTITY_GAP + ENTITY_SECTION_GAP
    : 0

  const placed = ordered.map(mission => {
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
    return { mission, children }
  })

  // Each mission's children sit on its own ring; rows and columns are sized
  // from what is actually drawn, so a mission with nothing linked stays
  // compact instead of reserving space for the busiest one.
  const laid = placed.map(({ mission, children }) => {
    const r = ringFor(children.length)
    const offsets = children.map((_, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / children.length
      return { x: Math.round(r * Math.cos(angle)), y: Math.round(RING_Y * r * Math.sin(angle)) }
    })
    const halfW = Math.max(MISSION_BOX.w / 2, ...offsets.map(o => Math.abs(o.x) + CHILD_BOX.w / 2))
    const top = Math.min(-MISSION_BOX.h / 2, ...offsets.map(o => o.y - CHILD_BOX.h / 2))
    const bottom = Math.max(MISSION_BOX.h / 2, ...offsets.map(o => o.y + CHILD_BOX.h / 2))
    return { mission, children, offsets, halfW, top, bottom }
  })
  const colW = laid.length
    ? 2 * Math.max(...laid.map(l => l.halfW), MISSION_BOX.w / 2) + PAD
    : MISSION_BOX.w + PAD * 2
  let rowTop = PAD + entityHeight
  for (let start = 0; start < laid.length; start += columns) {
    const row = laid.slice(start, start + columns)
    const above = Math.max(...row.map(l => -l.top))
    const below = Math.max(...row.map(l => l.bottom))
    row.forEach(({ mission, children, offsets }, col) => {
      const cx = colW / 2 + col * colW
      const cy = rowTop + above
      nodes.push({ id: `mission:${mission.id}`, kind: 'mission', missionId: mission.id, label: mission.title || 'Untitled mission', x: cx, y: cy, state: mission.state, detail: mission.finishLine })
      children.forEach((child, i) => {
        nodes.push({ id: child.id, kind: child.kind, missionId: mission.id, label: child.label, x: cx + offsets[i].x, y: cy + offsets[i].y })
        edges.push({ from: `mission:${mission.id}`, to: child.id, label: child.edge, provenance: child.provenance, kind: 'saved' })
      })
    })
    rowTop += above + below + PAD
  }

  const nodeIds = new Set(nodes.map(node => node.id))
  for (const link of territoryLinks) {
    const from = endpointNodeId(link.fromKind, link.fromId)
    const to = endpointNodeId(link.toKind, link.toId)
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue
    edges.push({ from, to, label: link.relation, provenance: `territory_links · ${link.provenance}`, kind: 'relation' })
  }

  const missionWidth = Math.min(columns, Math.max(1, laid.length)) * colW
  const entityWidth = entityList.length ? entityCols * ENTITY_COL_W : 0
  return {
    nodes,
    edges,
    width: Math.max(missionWidth, entityWidth, MISSION_BOX.w + PAD * 2),
    height: Math.max(rowTop, entityHeight, MISSION_BOX.h + PAD * 2),
  }
}
