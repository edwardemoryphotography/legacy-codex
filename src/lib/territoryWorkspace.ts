export type TerritoryEndpointKind = 'mission' | 'territory_node'
export type TerritoryEnergy = 'crashed' | 'low' | 'steady' | 'flow'

export interface TerritoryLink {
  id: string
  fromKind: TerritoryEndpointKind
  fromId: string
  toKind: TerritoryEndpointKind
  toId: string
  relation: string
  provenance: 'person' | 'mission_event' | 'import'
  createdAt: string
}

export interface TerritoryState {
  activeProject: string | null
  energy: TerritoryEnergy | null
  nextAction: string | null
  updatedAt: string
}

export interface TerritoryEvent {
  id: string
  type: 'state_saved' | 'log_entry' | 'link_created' | 'link_removed'
  detail: string
  createdAt: string
}

export interface TerritoryLinkInput {
  fromKind: TerritoryEndpointKind
  fromId: string
  toKind: TerritoryEndpointKind
  toId: string
  relation: string
  fromLabel?: string
  toLabel?: string
}

export const TERRITORY_ENERGIES: TerritoryEnergy[] = ['crashed', 'low', 'steady', 'flow']
export const TERRITORY_ENERGY_LABELS: Record<TerritoryEnergy, string> = {
  crashed: 'Crashed',
  low: 'Low',
  steady: 'Steady',
  flow: 'Flow',
}

export interface TerritoryLinkRow {
  id: string
  from_kind: TerritoryEndpointKind
  from_id: string
  to_kind: TerritoryEndpointKind
  to_id: string
  relation: string
  provenance: TerritoryLink['provenance']
  created_at: string
}
export interface TerritoryStateRow {
  active_project: string | null
  energy: TerritoryEnergy | null
  next_action: string | null
  updated_at: string
}
export interface TerritoryEventRow {
  id: string
  type: TerritoryEvent['type']
  detail: string
  created_at: string
}

export function rowToTerritoryLink(row: TerritoryLinkRow): TerritoryLink {
  return {
    id: row.id,
    fromKind: row.from_kind,
    fromId: row.from_id,
    toKind: row.to_kind,
    toId: row.to_id,
    relation: row.relation,
    provenance: row.provenance,
    createdAt: row.created_at,
  }
}
export function rowToTerritoryState(row: TerritoryStateRow): TerritoryState {
  return { activeProject: row.active_project, energy: row.energy, nextAction: row.next_action, updatedAt: row.updated_at }
}
export function rowToTerritoryEvent(row: TerritoryEventRow): TerritoryEvent {
  return { id: row.id, type: row.type, detail: row.detail, createdAt: row.created_at }
}

export function endpointNodeId(kind: TerritoryEndpointKind, id: string): string {
  return kind === 'mission' ? `mission:${id}` : `node:${id}`
}
