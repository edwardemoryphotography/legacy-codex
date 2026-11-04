export const TERRITORY_ENTITY_KINDS = ['project', 'doctrine', 'constraint'] as const
export type TerritoryEntityKind = (typeof TERRITORY_ENTITY_KINDS)[number]

export const TERRITORY_SIGNALS = ['ship', 'wip', 'proto', 'frozen', 'failed'] as const
export type TerritorySignal = (typeof TERRITORY_SIGNALS)[number]

export interface TerritoryEntity {
  id: string
  kind: TerritoryEntityKind
  label: string
  description: string
  signal: TerritorySignal | null
  cluster: string | null
  createdAt: string
  updatedAt: string
}

export interface TerritoryEntityInput {
  kind: TerritoryEntityKind
  label: string
  description: string
  signal: TerritorySignal | null
  cluster: string | null
}

export const TERRITORY_KIND_LABELS: Record<TerritoryEntityKind, string> = {
  project: 'Project',
  doctrine: 'Doctrine',
  constraint: 'Constraint',
}

export const TERRITORY_SIGNAL_LABELS: Record<TerritorySignal, string> = {
  ship: 'Shipped',
  wip: 'In progress',
  proto: 'Prototype',
  frozen: 'Frozen',
  failed: 'Failed',
}

export const TERRITORY_KIND_ORDER: TerritoryEntityKind[] = ['project', 'doctrine', 'constraint']

export function isTerritoryEntityKind(value: unknown): value is TerritoryEntityKind {
  return typeof value === 'string' && (TERRITORY_ENTITY_KINDS as readonly string[]).includes(value)
}

export function isTerritorySignal(value: unknown): value is TerritorySignal {
  return typeof value === 'string' && (TERRITORY_SIGNALS as readonly string[]).includes(value)
}

export interface TerritoryNodeRow {
  id: string
  kind: string
  label: string
  description: string | null
  signal: string | null
  cluster: string | null
  created_at: string
  updated_at: string
}

export function rowToTerritoryEntity(row: TerritoryNodeRow): TerritoryEntity {
  return {
    id: row.id,
    kind: isTerritoryEntityKind(row.kind) ? row.kind : 'project',
    label: row.label,
    description: row.description ?? '',
    signal: isTerritorySignal(row.signal) ? row.signal : null,
    cluster: row.cluster,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Stable display order: projects, doctrine, constraints, then label. */
export function sortTerritoryEntities(entities: TerritoryEntity[]): TerritoryEntity[] {
  return [...entities].sort((a, b) =>
    TERRITORY_KIND_ORDER.indexOf(a.kind) - TERRITORY_KIND_ORDER.indexOf(b.kind)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id))
}
