import { MISSION_UUID } from './learnedContextServer'
import {
  clampText,
  safeEnergy,
  TERRITORY_MAX_ENTITIES,
  TERRITORY_MAX_EVENTS,
  TERRITORY_MAX_HOP_LINKS,
  TERRITORY_MAX_LINKS,
  type ContextEndpoint,
  type ContextEntity,
  type ContextEvent,
  type ContextLink,
  type Section,
  type TerritoryContextData,
  type TerritoryContextScope,
} from './territoryContext'

// Minimal structural view of the caller's own RLS Supabase client
// (projectUserClient). No admin key is ever used here.
type Result = { data: unknown; error: unknown }
interface Query extends PromiseLike<Result> {
  select(columns: string): Query
  eq(column: string, value: string): Query
  in(column: string, values: string[]): Query
  or(filter: string): Query
  order(column: string, options: { ascending: boolean }): Query
  limit(count: number): Query
  maybeSingle(): PromiseLike<Result>
}
export interface TerritoryReadClient { from(table: string): unknown }

type Row = Record<string, unknown>

async function read(query: PromiseLike<Result>): Promise<Row[] | null> {
  try {
    const { data, error } = await query
    if (error) return null
    return Array.isArray(data) ? (data as Row[]) : data ? [data as Row] : []
  } catch {
    return null
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value : null)

// Never throws: every section reports ok or failed on its own, so an unread
// section is worded as unknown, never as empty. Everything is filtered by the
// caller's user id on top of RLS.
export async function loadTerritoryContext(
  client: TerritoryReadClient,
  userId: string,
  scope: TerritoryContextScope,
  missionId?: string,
): Promise<TerritoryContextData> {
  if (scope === 'mission' && (!missionId || !MISSION_UUID.test(missionId))) throw new Error('Invalid territory mission scope.')
  const whole = scope === 'all'
  const from = (table: string) => client.from(table) as Query

  const stateQuery = from('territory_state').select(whole ? 'active_project,energy,next_action,updated_at' : 'energy').eq('user_id', userId).maybeSingle()
  const linkQuery = whole
    ? from('territory_links').select('id,from_kind,from_id,to_kind,to_id,relation,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(TERRITORY_MAX_LINKS + 1)
    : from('territory_links').select('id,from_kind,from_id,to_kind,to_id,relation,created_at').eq('user_id', userId)
      .or(`and(from_kind.eq.mission,from_id.eq.${missionId}),and(to_kind.eq.mission,to_id.eq.${missionId})`)
      .order('created_at', { ascending: false }).limit(TERRITORY_MAX_HOP_LINKS + 1)
  const [stateRows, linkRows, entityRows, eventRows] = await Promise.all([
    read(stateQuery),
    read(linkQuery),
    whole ? read(from('territory_nodes').select('id,kind,label,description,signal,cluster,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(TERRITORY_MAX_ENTITIES + 1)) : Promise.resolve([]),
    whole ? read(from('territory_events').select('id,type,detail,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(TERRITORY_MAX_EVENTS + 1)) : Promise.resolve([]),
  ])

  const stateRow = stateRows?.[0]
  const state: TerritoryContextData['state'] = stateRows === null
    ? { read: 'failed' }
    : {
        read: 'ok',
        value: stateRow
          ? { activeProject: clampText(stateRow.active_project), energy: safeEnergy(stateRow.energy), nextAction: clampText(stateRow.next_action), updatedAt: str(stateRow.updated_at) }
          : null,
      }

  const entities: ContextEntity[] = (entityRows ?? []).slice(0, TERRITORY_MAX_ENTITIES).map(row => ({
    id: String(row.id),
    kind: clampText(row.kind, 40) ?? 'project',
    label: clampText(row.label) ?? 'Untitled entity',
    description: clampText(row.description),
    signal: clampText(row.signal, 40),
    cluster: clampText(row.cluster),
  }))

  const rawLinks = (linkRows ?? []).slice(0, whole ? TERRITORY_MAX_LINKS : TERRITORY_MAX_HOP_LINKS)
  const endpointIds = (kind: string) => [...new Set(rawLinks.flatMap(l => [l.from_kind === kind ? str(l.from_id) : null, l.to_kind === kind ? str(l.to_id) : null]).filter((id): id is string => Boolean(id)))]
  const missionIds = endpointIds('mission')
  const knownEntities = new Map(entities.map(e => [e.id, e]))
  const nodeIds = endpointIds('territory_node').filter(id => !knownEntities.has(id))
  // Linked missions: id, title, state only — never why, finish line or blocker.
  const [missionRows, nodeRows] = await Promise.all([
    missionIds.length ? read(from('missions').select('id,title,state').eq('user_id', userId).in('id', missionIds)) : Promise.resolve([]),
    nodeIds.length ? read(from('territory_nodes').select('id,kind,label,description,signal').eq('user_id', userId).in('id', nodeIds)) : Promise.resolve([]),
  ])
  const missionsById = new Map((missionRows ?? []).map(r => [String(r.id), r]))
  const nodesById = new Map((nodeRows ?? []).map(r => [String(r.id), r]))

  const endpoint = (kind: unknown, id: unknown): ContextEndpoint => {
    const key = String(id)
    if (kind === 'mission') {
      const row = missionsById.get(key)
      if (!row) return { kind: 'mission', id: key, label: null, missing: missionRows === null ? 'read_failed' : 'not_found' }
      return { kind: 'mission', id: key, label: clampText(row.title) ?? 'Untitled mission', state: clampText(row.state, 40) }
    }
    const known = knownEntities.get(key)
    if (known) return { kind: 'territory_node', id: key, label: known.label, entityKind: known.kind, signal: known.signal, description: known.description }
    const row = nodesById.get(key)
    if (!row) return { kind: 'territory_node', id: key, label: null, missing: nodeRows === null ? 'read_failed' : 'not_found' }
    return { kind: 'territory_node', id: key, label: clampText(row.label) ?? 'Untitled entity', entityKind: clampText(row.kind, 40), signal: clampText(row.signal, 40), description: clampText(row.description) }
  }

  const links: ContextLink[] = rawLinks.map(row => ({
    id: String(row.id),
    relation: clampText(row.relation, 80) ?? 'related',
    from: endpoint(row.from_kind, row.from_id),
    to: endpoint(row.to_kind, row.to_id),
    createdAt: str(row.created_at),
  }))

  const events: ContextEvent[] = (eventRows ?? []).slice(0, TERRITORY_MAX_EVENTS).map(row => ({
    id: String(row.id),
    type: clampText(row.type, 40) ?? 'log_entry',
    detail: clampText(row.detail) ?? '',
    createdAt: str(row.created_at),
  }))

  const sectionOf = <T>(rows: Row[] | null, mapped: T[], cap: number): Section<T> =>
    rows === null ? { read: 'failed' } : { read: 'ok', rows: mapped, truncated: rows.length > cap }

  return {
    scope,
    ...(missionId ? { missionId } : {}),
    state,
    entities: sectionOf(entityRows, entities, TERRITORY_MAX_ENTITIES),
    links: sectionOf(linkRows, links, whole ? TERRITORY_MAX_LINKS : TERRITORY_MAX_HOP_LINKS),
    events: sectionOf(eventRows, events, TERRITORY_MAX_EVENTS),
  }
}
