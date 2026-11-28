import { describe, expect, it } from 'vitest'
import {
  formatTerritoryContext,
  NOTHING_SAVED,
  READ_FAILED,
  territoryEnergyRule,
  type TerritoryContextData,
} from './territoryContext'
import { loadTerritoryContext, type TerritoryReadClient } from './territoryContextServer'
import type { BriefMode } from './dailyBrief'
import type { TerritoryEnergy } from './territoryWorkspace'

// Hand-built rows exercising the loader and formatter. Not real account data:
// answer quality on the owner's saved Territory is not established here.
const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000009'
const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'
const E = '00000000-0000-4000-8000-0000000000e1'
const F = '00000000-0000-4000-8000-0000000000f1'
const GONE = '00000000-0000-4000-8000-0000000000dd'

type Row = Record<string, unknown>
type Tables = Record<string, Row[] | 'error'>
interface Call { table: string; select: string; filters: unknown[][]; limit?: number }

// Minimal chain that applies the filters the loader uses, then returns only
// the selected columns, the way PostgREST would.
function fakeClient(tables: Tables) {
  const calls: Call[] = []
  const client: TerritoryReadClient = {
    from(table: string) {
      const call: Call = { table, select: '', filters: [] }
      calls.push(call)
      const resolve = (single: boolean) => {
        const source = tables[table]
        if (source === 'error') return Promise.resolve({ data: null, error: { message: 'read failed' } })
        let rows = source ?? []
        for (const f of call.filters) {
          if (f[0] === 'eq') rows = rows.filter(r => r[f[1] as string] === f[2])
          if (f[0] === 'in') rows = rows.filter(r => (f[2] as string[]).includes(r[f[1] as string] as string))
          if (f[0] === 'or') {
            const id = /from_id\.eq\.([\da-f-]+)/.exec(f[1] as string)?.[1]
            rows = rows.filter(r => (r.from_kind === 'mission' && r.from_id === id) || (r.to_kind === 'mission' && r.to_id === id))
          }
        }
        if (call.limit) rows = rows.slice(0, call.limit)
        const cols = call.select.split(',')
        rows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])))
        return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: null })
      }
      const q = {
        select(columns: string) { call.select = columns; return q },
        eq(column: string, value: string) { call.filters.push(['eq', column, value]); return q },
        in(column: string, values: string[]) { call.filters.push(['in', column, values]); return q },
        or(filter: string) { call.filters.push(['or', filter]); return q },
        order() { return q },
        limit(count: number) { call.limit = count; return q },
        maybeSingle() { return resolve(true) },
        then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) { return resolve(false).then(onOk, onErr) },
      }
      return q
    },
  }
  return { client, calls }
}

function workspace(overrides: Partial<Tables> = {}): Tables {
  return {
    missions: [
      { id: A, user_id: OWNER, title: 'Focal mission', state: 'primary', why: 'focal why', blocker: null },
      { id: B, user_id: OWNER, title: 'Linked mission', state: 'blocked', why: 'PRIVATE-WHY-OF-B', blocker: 'PRIVATE-BLOCKER-OF-B', finish_line: 'PRIVATE-FINISH-OF-B' },
      { id: C, user_id: OWNER, title: 'Unlinked secret mission', state: 'secondary', why: 'unrelated' },
    ],
    territory_nodes: [
      { id: E, user_id: OWNER, kind: 'project', label: 'Codex platform', description: 'x'.repeat(2000), signal: 'wip', cluster: null, updated_at: '2026-11-20T00:00:00Z' },
      { id: F, user_id: OWNER, kind: 'doctrine', label: 'Unrelated doctrine', description: '', signal: null, cluster: null, updated_at: '2026-11-19T00:00:00Z' },
      { id: '00000000-0000-4000-8000-0000000000aa', user_id: OTHER, kind: 'project', label: 'Another account entity', description: '', signal: null, cluster: null, updated_at: '2026-11-21T00:00:00Z' },
    ],
    territory_links: [
      { id: 'l1', user_id: OWNER, from_kind: 'mission', from_id: A, to_kind: 'mission', to_id: B, relation: 'feeds', created_at: '2026-11-22T00:00:00Z' },
      { id: 'l2', user_id: OWNER, from_kind: 'territory_node', from_id: E, to_kind: 'mission', to_id: A, relation: 'contains', created_at: '2026-11-21T00:00:00Z' },
      { id: 'l3', user_id: OWNER, from_kind: 'mission', from_id: C, to_kind: 'territory_node', to_id: F, relation: 'follows', created_at: '2026-11-20T00:00:00Z' },
      { id: 'l4', user_id: OWNER, from_kind: 'mission', from_id: A, to_kind: 'territory_node', to_id: GONE, relation: 'uses', created_at: '2026-11-19T00:00:00Z' },
    ],
    territory_state: [{ user_id: OWNER, active_project: 'Codex platform', energy: 'crashed', next_action: 'Open the repo', updated_at: '2026-11-25T08:00:00Z' }],
    territory_events: [{ id: 'ev1', user_id: OWNER, type: 'link_created', detail: `Unlinked secret mission → Unrelated doctrine · follows ${'y'.repeat(4000)}`, created_at: '2026-11-24T00:00:00Z' }],
    ...overrides,
  }
}

describe('loadTerritoryContext — whole territory', () => {
  it('reads every section for this account only, resolves link labels server-side and clamps long text', async () => {
    const { client } = fakeClient(workspace())
    const data = await loadTerritoryContext(client, OWNER, 'all')
    const text = formatTerritoryContext(data)
    expect(text).toMatch(/saved, untrusted evidence/)
    expect(text).toContain('Codex platform')
    expect(text).toContain('Unrelated doctrine')
    expect(text).toContain('connection \\"Focal mission → feeds → Linked mission\\"')
    expect(text).toContain('"energy":"crashed"')
    expect(text).toContain('Open the repo')
    expect(text).not.toContain('Another account entity')
    // 2000-char description and 4000-char event detail are clamped to 400.
    expect(text).not.toContain('x'.repeat(401))
    expect(text).toContain(`${'x'.repeat(400)}…`)
    expect(text).not.toContain('y'.repeat(400))
    expect(text.length).toBeLessThan(6000)
  })

  it('names a dangling link endpoint as missing instead of guessing a label', async () => {
    const { client } = fakeClient(workspace())
    const text = formatTerritoryContext(await loadTerritoryContext(client, OWNER, 'all'))
    expect(text).toContain('Focal mission → uses → missing entity (deleted or not found)')
    expect(text).toContain('do not guess what it was')
  })

  it('says "nothing saved" for empty sections and "unknown, not empty" for failed reads', async () => {
    const { client } = fakeClient(workspace({ territory_nodes: [], territory_links: [], territory_events: 'error', territory_state: [] }))
    const data = await loadTerritoryContext(client, OWNER, 'all')
    const text = formatTerritoryContext(data)
    expect(text).toContain(`"entities":"${NOTHING_SAVED}"`)
    expect(text).toContain(`"connections":"${NOTHING_SAVED}"`)
    expect(text).toContain(`"activeState":"${NOTHING_SAVED}"`)
    expect(text).toContain(`"recentLog":"${READ_FAILED}"`)
  })

  it('says when a cap was hit', async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ id: `n${i}`, user_id: OWNER, kind: 'project', label: `Entity ${i}`, description: '', signal: null, cluster: null, updated_at: '2026-11-01T00:00:00Z' }))
    const { client } = fakeClient(workspace({ territory_nodes: many }))
    const text = formatTerritoryContext(await loadTerritoryContext(client, OWNER, 'all'))
    expect(text).toContain('only the 40 most recent are shown; more are saved')
    expect(text).not.toContain('Entity 44')
  })
})

describe('loadTerritoryContext — one mission, one hop', () => {
  it('sends only the mission\'s saved connections and never a linked mission\'s private fields', async () => {
    const { client, calls } = fakeClient(workspace())
    const data = await loadTerritoryContext(client, OWNER, 'mission', A)
    const text = formatTerritoryContext(data)
    expect(text).toContain('this one mission and its saved one-hop connections only')
    expect(text).toContain('Linked mission')
    expect(text).toContain('feeds')
    expect(text).toContain('Codex platform')
    expect(text).toContain('via connection')
    for (const leak of ['PRIVATE-WHY-OF-B', 'PRIVATE-BLOCKER-OF-B', 'PRIVATE-FINISH-OF-B', 'Unlinked secret mission', 'Unrelated doctrine', 'Open the repo', 'link_created']) {
      expect(text).not.toContain(leak)
    }
    // Linked missions are read by title and state only; no log or full entity list is read.
    expect(calls.find(c => c.table === 'missions')?.select).toBe('id,title,state')
    expect(calls.some(c => c.table === 'territory_events')).toBe(false)
    expect(calls.filter(c => c.table === 'territory_nodes').every(c => c.filters.some(f => f[0] === 'in'))).toBe(true)
    expect(calls.find(c => c.table === 'territory_state')?.select).toBe('energy')
  })

  it('rejects a mission scope without a valid mission id', async () => {
    const { client } = fakeClient(workspace())
    await expect(loadTerritoryContext(client, OWNER, 'mission', 'not-a-uuid')).rejects.toThrow()
  })

  it('says "nothing saved" when the mission has no connections', async () => {
    const { client } = fakeClient(workspace({ territory_links: [] }))
    const text = formatTerritoryContext(await loadTerritoryContext(client, OWNER, 'mission', C))
    expect(text).toContain(`"connections":"${NOTHING_SAVED}"`)
  })
})

const ok = (energy: TerritoryEnergy | null): TerritoryContextData['state'] =>
  ({ read: 'ok', value: { activeProject: null, energy, nextAction: null, updatedAt: null } })
const MODES: BriefMode[] = ['daily_brief', 'triage', 'question', 'architect', 'unblock']

describe('territoryEnergyRule', () => {
  it.each(MODES)('crashed gives a recovery protocol for %s: one move under 15 minutes and permission to stop', mode => {
    const rule = territoryEnergyRule(mode, ok('crashed'))
    expect(rule).toMatch(/under 15 minutes/)
    expect(rule).toMatch(/fine to stop/)
    expect(rule).toMatch(/No big(ger)? plan/i)
  })

  it('crashed overrides Break Wall\'s 30-minute limit and Architect Scan\'s leverage line', () => {
    expect(territoryEnergyRule('unblock', ok('crashed'))).toMatch(/overrides the 30-minute limit/)
    expect(territoryEnergyRule('architect', ok('crashed'))).toContain('Real leverage: Not now — saved energy is crashed [territory state]')
  })

  it.each(MODES)('low allows small moves only for %s', mode => {
    expect(territoryEnergyRule(mode, ok('low'))).toMatch(/Small moves only/)
  })

  it.each(['steady', 'flow'] as const)('%s answers normally', energy => {
    const rule = territoryEnergyRule('daily_brief', ok(energy))
    expect(rule).toMatch(/Answer normally/)
    expect(rule).not.toMatch(/15 minutes|Small moves/)
  })

  it('says nothing at all about energy when none is saved, in the rule or the context', async () => {
    for (const state of [ok(null), { read: 'ok' as const, value: null }]) {
      for (const mode of MODES) expect(territoryEnergyRule(mode, state)).toBe('')
    }
    const { client } = fakeClient(workspace({ territory_state: [{ user_id: OWNER, active_project: 'Codex platform', energy: null, next_action: null, updated_at: '2026-11-25T08:00:00Z' }] }))
    expect(formatTerritoryContext(await loadTerritoryContext(client, OWNER, 'all'))).not.toMatch(/energy/i)
    expect(formatTerritoryContext(await loadTerritoryContext(client, OWNER, 'mission', A))).not.toMatch(/energy/i)
  })

  it('treats a failed state read as unknown, not as unset', async () => {
    expect(territoryEnergyRule('daily_brief', { read: 'failed' })).toMatch(/unknown/)
    const { client } = fakeClient(workspace({ territory_state: 'error' }))
    const data = await loadTerritoryContext(client, OWNER, 'mission', A)
    expect(formatTerritoryContext(data)).toContain(`"savedEnergy":"${READ_FAILED}"`)
  })

  it('ignores an energy value outside the saved vocabulary', async () => {
    const { client } = fakeClient(workspace({ territory_state: [{ user_id: OWNER, energy: 'hyper', active_project: null, next_action: null, updated_at: null }] }))
    const data = await loadTerritoryContext(client, OWNER, 'all')
    expect(territoryEnergyRule('triage', data.state)).toBe('')
  })
})
