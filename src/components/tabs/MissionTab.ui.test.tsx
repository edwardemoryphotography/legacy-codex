/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissionTab, { VISITOR_ACCESS_COPY, missionToRow } from './MissionTab'
import { predictStrategicDelta } from '@/lib/strategicDelta'
import type { Mission } from '@/types'

vi.mock('@/components/ActivityOrb', () => ({
  default: () => null,
}))

const connectMissionSession = vi.fn()

vi.mock('@/lib/supabase/missionSession', () => ({
  connectMissionSession: () => connectMissionSession(),
  missionConnectionMessage: () => 'This version could not open a session. Use the main Legacy Codex site, then try again.',
}))

function chain(data: unknown[] = [], error: unknown = null, response?: Promise<{ data: unknown[] | null; error: unknown }>) {
  const promise = response ?? Promise.resolve({ data: error ? null : data, error })
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    not: () => query,
    then: promise.then.bind(promise),
  }
  return query
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'token', user: { id: 'user-1' } } }, error: null }),
    },
    from: (table: string) => ({
      ...chain(tables[table] ?? [], failNext[table] ? (failNext[table] = false, { message: 'read failed' }) : null, table === 'missions' ? missionReadResponse ?? undefined : undefined),
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: failInsert[table] ? { message: 'insert failed' } : null })
      },
      upsert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        for (const row of list) inserts.push({ table, row })
        return persistMissionRows ? persistMissionRows() : Promise.resolve({ error: null })
      },
      delete: () => ({ eq: () => Promise.resolve({ error: failDelete ? { message: 'cleanup failed' } : null }) }),
    }),
  },
}))

let tables: Record<string, unknown[]> = {}
let failNext: Record<string, boolean> = {}
let inserts: Array<{ table: string, row: Record<string, unknown> }> = []
let persistMissionRows: (() => Promise<{ error: unknown }>) | null = null
let failInsert: Record<string, boolean> = {}
let failDelete = false
let missionReadResponse: Promise<{ data: unknown[] | null; error: unknown }> | null = null

// Regression doubles exercise the real UI/lifecycle, not production proof.
describe('MissionTab inactive mission recovery', () => {
  const saved: Mission = {
    id: 'saved-inactive', title: 'Write the studio lighting reference', why: 'For the studio',
    finishLine: 'The lighting reference is posted where the studio can use it',
    evidenceRequirement: 'The posted reference', state: 'abandoned', blocker: 'Awaiting studio access',
    capacityMismatch: true, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
  }

  beforeEach(() => {
    inserts = []
    failNext = {}
    persistMissionRows = null
    failInsert = {}
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = { missions: [missionToRow(saved, 'user-1')], evidence_snapshots: [], actions: [], mission_events: [] }
  })

  it.each(['abandoned', 'paused'] as const)('requires explicit selection and promotes the same %s mission with its constraints intact', async state => {
    tables.missions = [missionToRow({ ...saved, state }, 'user-1')]
    const view = render(<MissionTab />)
    const select = await screen.findByLabelText('Choose a saved mission')
    expect(screen.queryByText('Nothing captured yet')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make this Primary' })).toBeNull()
    expect(inserts).toEqual([])
    fireEvent.change(select, { target: { value: 'saved-inactive' } })
    expect(screen.getByText('Still blocked: Awaiting studio access')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make this Primary' })) })
    const row = inserts.find(i => i.table === 'missions')!.row
    expect(row).toMatchObject({ id: 'saved-inactive', state: 'primary', blocker: 'Awaiting studio access', capacity_mismatch: true, evidence_requirement: 'The posted reference' })
    expect(inserts.filter(i => i.table === 'mission_events')).toHaveLength(1)
    expect(inserts.some(i => i.table === 'actions')).toBe(false)
    tables.missions = [row]
    inserts = []
    view.unmount()
    render(<MissionTab />)
    await screen.findByText('Your next move')
    await waitFor(() => expect(screen.queryByLabelText('Choose a saved mission')).toBeNull())
    expect(screen.queryByText('Nothing captured yet')).toBeNull()
    expect(inserts).toEqual([])
  })

  it('saves a missing finish line before offering explicit promotion', async () => {
    tables.missions = [missionToRow({ ...saved, finishLine: null }, 'user-1')]
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), { target: { value: 'The reference is published' } })
    expect(screen.queryByRole('button', { name: 'Make this Primary' })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save finish line' })) })
    expect(inserts.find(i => i.table === 'missions')!.row).toMatchObject({ id: 'saved-inactive', state: 'abandoned', finish_line: 'The reference is published' })
    expect(screen.getByRole('button', { name: 'Make this Primary' })).toBeTruthy()
    expect(inserts.some(i => i.row.type === 'promoted_primary')).toBe(false)
  })

  it('retains selection and draft after a failed finish-line write', async () => {
    tables.missions = [missionToRow({ ...saved, finishLine: null }, 'user-1')]
    persistMissionRows = async () => ({ error: { message: 'write failed' } })
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), { target: { value: 'The reference is published' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save finish line' })) })
    expect((screen.getByLabelText('How you will know it is done') as HTMLInputElement).value).toBe('The reference is published')
    expect(screen.queryByRole('button', { name: 'Make this Primary' })).toBeNull()
    expect(inserts.some(i => i.table === 'mission_events')).toBe(false)
  })

  it('disables the other promotion path until finish-line persistence settles', async () => {
    tables.missions = [missionToRow({ ...saved, state: 'parked', finishLine: null }, 'user-1')]
    let settle!: (value: { error: unknown }) => void
    persistMissionRows = () => new Promise(resolve => { settle = resolve })
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), { target: { value: 'The reference is published' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save finish line' }))
    const otherPromote = await screen.findByRole('button', { name: 'Promote to Primary' })
    expect((otherPromote as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(otherPromote)
    expect(inserts.filter(i => i.table === 'missions')).toHaveLength(1)
    await act(async () => { settle({ error: null }) })
    expect((screen.getByRole('button', { name: 'Promote to Primary' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not record two promotions for rapid repeat taps', async () => {
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    const promote = screen.getByRole('button', { name: 'Make this Primary' })
    await act(async () => { fireEvent.click(promote); fireEvent.click(promote) })
    expect(inserts.filter(i => i.row.type === 'promoted_primary')).toHaveLength(1)
  })

  it('does not let a recheck overwrite a promotion that is still saving', async () => {
    let settle!: (value: { error: unknown }) => void
    persistMissionRows = () => new Promise(resolve => { settle = resolve })
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make this Primary' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Something changed' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Just recheck' })) })
    expect(screen.queryByLabelText('Choose a saved mission')).toBeNull()
    await act(async () => { settle({ error: null }) })
    expect(screen.queryByLabelText('Choose a saved mission')).toBeNull()
  })

  it('waits for an already-running authoritative read before allowing a lifecycle change', async () => {
    tables.missions = [missionToRow({ ...saved, state: 'primary' }, 'user-1')]
    render(<MissionTab />)
    await screen.findByRole('button', { name: 'Something changed' })
    let settle!: (value: { data: unknown[]; error: unknown }) => void
    missionReadResponse = new Promise(resolve => { settle = resolve })
    fireEvent.click(screen.getByRole('button', { name: 'Something changed' }))
    fireEvent.click(screen.getByRole('button', { name: 'Just recheck' }))
    const pause = screen.getByRole('button', { name: 'Deliberately pause' }) as HTMLButtonElement
    expect(pause.disabled).toBe(true)
    fireEvent.click(pause)
    expect(inserts).toEqual([])
    missionReadResponse = null
    await act(async () => { settle({ data: tables.missions, error: null }) })
    expect((screen.getByRole('button', { name: 'Deliberately pause' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Deliberately pause' })) })
    expect(inserts.find(i => i.table === 'missions')!.row).toMatchObject({ id: 'saved-inactive', state: 'paused' })
  })

  it('requires an authoritative refresh when both history and compensation fail', async () => {
    failInsert.mission_events = true
    let attempts = 0
    persistMissionRows = async () => ({ error: ++attempts === 1 ? null : { message: 'compensation failed' } })
    render(<MissionTab />)
    fireEvent.change(await screen.findByLabelText('Choose a saved mission'), { target: { value: 'saved-inactive' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make this Primary' })) })
    expect(screen.getByText(/Write partially saved/)).toBeTruthy()
    expect(screen.queryByLabelText('Choose a saved mission')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start a new Primary mission' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Promote to Primary' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
    // A successful authoritative read can restore mutations, even when the
    // final persisted state differs from the optimistic rollback.
    tables.missions = [missionToRow({ ...saved, state: 'primary' }, 'user-1')]
    failInsert = {}
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check again' })) })
    await screen.findByText('Connected')
    expect(screen.queryByText(/Write partially saved/)).toBeNull()
    expect(screen.queryByLabelText('Choose a saved mission')).toBeNull()
  })

  it('keeps completed missions in history and creates a new Primary only on submission', async () => {
    tables.missions = [missionToRow({ ...saved, state: 'completed' }, 'user-1')]
    render(<MissionTab />)
    await screen.findByRole('button', { name: 'Start a new Primary mission' })
    expect(screen.queryByLabelText('Choose a saved mission')).toBeNull()
    expect(screen.queryByText('Nothing captured yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new Primary mission' }))
    fireEvent.change(screen.getByLabelText('Your idea or project'), { target: { value: 'Publish the next reference' } })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), { target: { value: 'The new reference is published' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'This is what matters' })) })
    expect(inserts.filter(i => i.table === 'missions')).toHaveLength(1)
    expect(inserts.find(i => i.table === 'missions')!.row).toMatchObject({ state: 'primary', title: 'Publish the next reference' })
    expect(inserts.find(i => i.table === 'missions')!.row.id).not.toBe('saved-inactive')
    expect(inserts.some(i => i.table === 'actions')).toBe(false)
  })

  it('withholds new-Primary controls when creation history and cleanup both fail', async () => {
    tables.missions = [missionToRow({ ...saved, state: 'completed' }, 'user-1')]
    failInsert.mission_events = true
    failDelete = true
    render(<MissionTab />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start a new Primary mission' }))
    fireEvent.change(screen.getByLabelText('Your idea or project'), { target: { value: 'Publish the next reference' } })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), { target: { value: 'The new reference is published' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'This is what matters' })) })
    expect(screen.getByText(/Write partially saved/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'This is what matters' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start a new Primary mission' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
    expect(inserts.filter(i => i.table === 'missions')).toHaveLength(1)
  })
})

beforeEach(() => { persistMissionRows = null; failInsert = {}; failDelete = false; missionReadResponse = null })

describe('MissionTab first-run presentation', () => {
  beforeEach(() => {
    tables = {}
    inserts = []
    connectMissionSession.mockReset()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ configured: false }),
    })))
  })

  it('invites a confirmed-empty session to write a real idea, without empty mission chrome', async () => {
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    render(<MissionTab />)

    expect(await screen.findByLabelText('Your idea or project')).toBeTruthy()
    expect(screen.getByLabelText('How you will know it is done')).toBeTruthy()
    expect(screen.getByLabelText('What will prove it is done')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'This is what matters' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'From idea to saved action' })).toBeTruthy()
    expect(screen.queryByText('Nothing parked.')).toBeNull()
    expect(screen.queryByText('Secondary Mission (none active)')).toBeNull()
    expect(screen.getByText('Park an idea you are not ready to commit')).toBeTruthy()
  })

  it('saves a filled evidence requirement on first-run create, and leaves empty as null', async () => {
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    tables = { missions: [], evidence_snapshots: [], actions: [], mission_events: [] }
    render(<MissionTab />)

    fireEvent.change(await screen.findByLabelText('Your idea or project'), {
      target: { value: 'TEST by agent - evidence box' },
    })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), {
      target: { value: 'The proof field is saved on the mission' },
    })
    fireEvent.change(screen.getByLabelText('What will prove it is done'), {
      target: { value: 'A screenshot of the Mission read-back showing the requirement' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'This is what matters' }))
    })

    await waitFor(() => expect(inserts.some(i => i.table === 'missions')).toBe(true))
    const row = inserts.find(i => i.table === 'missions')!.row
    expect(row.title).toBe('TEST by agent - evidence box')
    expect(row.finish_line).toBe('The proof field is saved on the mission')
    expect(row.evidence_requirement).toBe('A screenshot of the Mission read-back showing the requirement')
    expect(row.state).toBe('primary')
  })

  it('saves null evidence_requirement when the optional field is left blank', async () => {
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    tables = { missions: [], evidence_snapshots: [], actions: [], mission_events: [] }
    render(<MissionTab />)

    fireEvent.change(await screen.findByLabelText('Your idea or project'), {
      target: { value: 'Ship without naming proof yet' },
    })
    fireEvent.change(screen.getByLabelText('How you will know it is done'), {
      target: { value: 'It is live' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'This is what matters' }))
    })

    await waitFor(() => expect(inserts.some(i => i.table === 'missions')).toBe(true))
    expect(inserts.find(i => i.table === 'missions')!.row.evidence_requirement).toBeNull()
  })

  it('does not present a failed read as an empty first run', async () => {
    connectMissionSession.mockRejectedValue(new Error('invalid api key'))
    render(<MissionTab />)

    expect(await screen.findByText(/could not open a session/i)).toBeTruthy()
    expect(screen.queryByLabelText('Your idea or project')).toBeNull()
    expect(screen.queryByText('Nothing parked.')).toBeNull()
    expect(screen.queryByRole('list', { name: 'From idea to saved action' })).toBeNull()
  })
})

describe('MissionTab acceptance continuity', () => {
  const mission: Mission = {
    id: 'm1',
    title: 'Write the studio lighting reference',
    why: '',
    finishLine: 'The lighting reference is posted where the studio can use it',
    evidenceRequirement: null,
    state: 'primary',
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }
  const predicted = predictStrategicDelta([mission], [], [], new Date().toISOString()).move

  beforeEach(() => {
    inserts = []
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = {
      missions: [{ ...missionToRow(mission, 'user-1'), created_at: mission.createdAt }],
      evidence_snapshots: [],
      actions: [],
      mission_events: [],
    }
  })

  it('comes back accepted after reload from the persisted delta_accepted row, and does not write again', async () => {
    tables.mission_events = [{
      id: 'e1', mission_id: 'm1', type: 'delta_accepted', detail: predicted, created_at: '2026-09-21T00:00:00.000Z',
    }]
    render(<MissionTab />)

    expect(await screen.findByText(/still a prediction until there's evidence/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Accept this move' })).toBeNull()
    expect(inserts).toEqual([])
    await waitFor(() => expect((document.getElementById('saved-action-title') as HTMLInputElement | null)?.value).toBe(predicted))
  })

  it('does not seed the saved-action composer with an acceptance the Delta no longer shows', async () => {
    // Accepted earlier, but the mission state now predicts a different move
    // (no correction or supplied step in between — e.g. the finish line changed).
    tables.mission_events = [{
      id: 'e1', mission_id: 'm1', type: 'delta_accepted', detail: 'An older move that is no longer predicted', created_at: '2026-09-21T00:00:00.000Z',
    }]
    render(<MissionTab />)

    expect(await screen.findByRole('button', { name: 'Accept this move' })).toBeTruthy()
    const composer = await waitFor(() => {
      const input = document.getElementById('saved-action-title') as HTMLInputElement | null
      expect(input).toBeTruthy()
      return input!
    })
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(composer.value).toBe('')
    expect(screen.queryByText('Same words as the recommendation you accepted.')).toBeNull()
  })

  it('a correction after the acceptance means reload does not show it accepted', async () => {
    tables.mission_events = [
      { id: 'e1', mission_id: 'm1', type: 'delta_accepted', detail: predicted, created_at: '2026-09-21T00:00:00.000Z' },
      { id: 'e2', mission_id: 'm1', type: 'delta_corrected', detail: JSON.stringify({ move: 'something else', reason: 'no' }), created_at: '2026-09-21T01:00:00.000Z' },
    ]
    render(<MissionTab />)

    expect(await screen.findByRole('button', { name: 'Accept this move' })).toBeTruthy()
    expect(screen.queryByText(/still a prediction until there's evidence/i)).toBeNull()
  })

  it('a rapid second tap records one delta_accepted row, with the candidate id, and no action', async () => {
    render(<MissionTab />)
    const accept = await screen.findByRole('button', { name: 'Accept this move' })
    await act(async () => {
      fireEvent.click(accept)
      fireEvent.click(accept)
    })

    await screen.findByText(/still a prediction until there's evidence/i)
    await waitFor(() => expect(inserts.filter(i => i.table === 'mission_events')).toHaveLength(1))
    const written = inserts[0].row
    expect(written.type).toBe('delta_accepted')
    expect(JSON.parse(written.detail as string).move).toBe(predicted)
    expect(inserts.some(i => i.table === 'actions')).toBe(false)
  })
})

describe('MissionTab failed read recovery', () => {
  beforeEach(() => {
    inserts = []
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = { missions: [], evidence_snapshots: [], actions: [], mission_events: [] }
    failNext = { missions: true }
  })

  it('"Check again" after a failed read clears the failure once the read succeeds', async () => {
    render(<MissionTab />)
    expect(await screen.findByText(/Could not load your missions/)).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: 'Check again' }))

    expect(await screen.findByLabelText('Your idea or project')).toBeTruthy()
    expect(screen.queryByText(/Could not load your missions/)).toBeNull()
  })

  it('keeps one "Check again" when a later read fails while earlier missions are still shown', async () => {
    failNext = {}
    const shown: Mission = {
      id: 'm1',
      title: 'Write the studio lighting reference',
      why: '',
      finishLine: 'The lighting reference is posted where the studio can use it',
      evidenceRequirement: null,
      state: 'primary',
      blocker: null,
      capacityMismatch: false,
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    }
    tables.missions = [{ ...missionToRow(shown, 'user-1'), created_at: shown.createdAt }]
    render(<MissionTab />)
    expect(await screen.findByRole('button', { name: 'Accept this move' })).toBeTruthy()

    failNext = { missions: true }
    fireEvent.click(screen.getByRole('button', { name: 'Something changed' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Just recheck' }))

    expect(await screen.findByText(/Could not load your missions/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Check again' })).toHaveLength(1)
  })
})

describe('MissionTab supplied steps across a finish-line revision', () => {
  const step = 'Export the five print sizes from the pricing spreadsheet into a draft page'
  const compound: Mission = {
    id: 'm1',
    title: 'Publish the print price list',
    why: '',
    finishLine: 'The price list is live on the site and linked from the contact page',
    evidenceRequirement: null,
    state: 'primary',
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }
  const stepRow = (clause: string) => ({
    id: 's1', mission_id: 'm1', type: 'delta_step_supplied',
    detail: JSON.stringify({ step, targetId: 'clause:m1:0', clause }), created_at: '2026-09-21T00:00:00.000Z',
  })

  beforeEach(() => {
    inserts = []
    failNext = {}
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = { missions: [{ ...missionToRow(compound, 'user-1'), created_at: compound.createdAt }], evidence_snapshots: [], actions: [] }
  })

  it('uses a step recorded for the current first clause', async () => {
    tables.mission_events = [stepRow('The price list is live on the site')]
    render(<MissionTab />)
    expect(await screen.findByText(step)).toBeTruthy()
    expect(await screen.findByText('You supplied this step — not verified')).toBeTruthy()
  })

  it('ignores a step recorded for a finish line the mission no longer has', async () => {
    tables.mission_events = [stepRow('The catalogue is printed')]
    render(<MissionTab />)
    expect(await screen.findByText('Needs a concrete step')).toBeTruthy()
    expect(screen.queryByText(step)).toBeNull()
  })
})

describe('MissionTab saves an accepted Secondary step against the Secondary', () => {
  const step = 'Email the framer and ask for the three frame prices today'
  const base = { why: '', evidenceRequirement: null, blocker: null, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' }
  const primary: Mission = { ...base, id: 'm1', title: 'Ship the Delta', finishLine: 'It ships, and it is reviewed', state: 'primary', capacityMismatch: true }
  const secondary: Mission = { ...base, id: 'm2', title: 'Price the frames', finishLine: 'The frame prices are listed and the order is placed', state: 'secondary', capacityMismatch: false }

  beforeEach(() => {
    inserts = []
    failNext = {}
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = {
      missions: [primary, secondary].map(m => ({ ...missionToRow(m, 'user-1'), created_at: m.createdAt })),
      evidence_snapshots: [],
      actions: [],
      mission_events: [
        { id: 's1', mission_id: 'm2', type: 'delta_step_supplied', detail: JSON.stringify({ step, targetId: 'clause:m2:0', clause: 'The frame prices are listed' }), created_at: '2026-09-21T00:00:00.000Z' },
        { id: 'a1', mission_id: 'm2', type: 'delta_accepted', detail: JSON.stringify({ move: step, finishLine: secondary.finishLine }), created_at: '2026-09-21T01:00:00.000Z' },
      ],
    }
  })

  it('seeds the composer with the accepted Secondary step and saves it with the Secondary mission id', async () => {
    render(<MissionTab />)
    expect(await screen.findByText(/still a prediction until there's evidence/)).toBeTruthy()
    const composer = await waitFor(() => {
      const input = document.getElementById('saved-action-title') as HTMLInputElement | null
      expect(input?.value).toBe(step)
      return input!
    })
    expect(composer).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save next action' }))
    await waitFor(() => expect(inserts.some(i => i.table === 'actions')).toBe(true))
    expect(inserts.find(i => i.table === 'actions')?.row.mission_id).toBe('m2')
  })

  it.each(['completed', 'paused', 'abandoned'] as const)('keeps the Secondary saved action reachable when Primary is %s', async state => {
    // Contract data only: no production writes or claim of real-session proof.
    tables.missions = [{ ...missionToRow({ ...primary, state }, 'user-1'), created_at: primary.createdAt },
      { ...missionToRow(secondary, 'user-1'), created_at: secondary.createdAt }]
    tables.actions = [{ id: 'secondary-action', mission_id: 'm2', action_title: step, status: 'TODO',
      resume_note: 'Continue with the three frame prices', updated_at: secondary.updatedAt,
      mission: { title: secondary.title, state: 'secondary' } }]
    const view = render(<MissionTab />)
    expect(await screen.findByRole('heading', { name: 'Your missions' })).toBeTruthy()
    await waitFor(() => expect(document.getElementById('saved-action-secondary-action')).toBeTruthy())
    await waitFor(() => expect(document.querySelector('.mission-path [aria-current="step"]')?.textContent).toContain('Saved action'))
    expect(screen.getByRole('button', { name: 'Start / resume' })).toBeTruthy()
    expect((screen.getByLabelText('Starting point') as HTMLTextAreaElement).value).toBe('Continue with the three frame prices')
    view.unmount()
    render(<MissionTab />)
    await waitFor(() => expect(document.getElementById('saved-action-secondary-action')).toBeTruthy())
    await waitFor(() => expect(document.querySelector('.mission-path [aria-current="step"]')?.textContent).toContain('Saved action'))
    expect(screen.queryByLabelText('Name the action to save')).toBeNull()
    expect(inserts).toEqual([])
  })
})

describe('MissionTab project-review access', () => {
  const mission: Mission = {
    id: 'm1',
    title: 'Print the portfolio',
    why: '',
    finishLine: 'Twenty prints are framed and hung',
    evidenceRequirement: null,
    state: 'primary',
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }
  const lesson = {
    id: 'l1', missionId: 'm1', scope: 'mission', rule: 'Confirm frame sizes before ordering prints',
    whenToApply: 'Before any print order', sourceIds: [], sourceRefs: [],
    confirmedAt: '2026-09-21T00:00:00.000Z', reviewedAt: '2026-09-21T00:00:00.000Z',
  }

  function respond(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }

  beforeEach(() => {
    inserts = []
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    tables = {
      missions: [{ ...missionToRow(mission, 'user-1'), created_at: mission.createdAt }],
      evidence_snapshots: [],
      actions: [],
      mission_events: [],
    }
  })

  it('a visitor (403) gets plain copy, no owner-only review read, no Review project, and no failed state', async () => {
    const fetchMock = vi.fn<(url: string) => Promise<ReturnType<typeof respond>>>(async () => respond(403, { error: 'Model-assisted candidates are not enabled for this account.' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MissionTab />)

    expect(await screen.findByText(VISITOR_ACCESS_COPY)).toBeTruthy()
    expect(await screen.findByRole('heading', { name: 'Your missions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Why this?' })).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/delta-review?missionId='))).toBe(false)
    expect(screen.queryByText(/not enabled for this account/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Review project' })).toBeNull()
    expect(screen.queryByText('This did not record')).toBeNull()
    expect(screen.queryByText(/Could not restore the project review/)).toBeNull()
    expect(document.querySelector('section.sd')!.getAttribute('data-cognition')).not.toBe('failed')
  })

  it('a 401 (unverified session) is not locked in as a visitor and fails quietly', async () => {
    const fetchMock = vi.fn(async (url: string) => String(url).includes('capabilities=1')
      ? respond(401, { error: 'Sign in to use model-assisted candidates.' })
      : respond(401, { error: 'Sign in to use model-assisted candidates.' }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MissionTab />)

    expect(await screen.findByText(/Smart suggestions are unavailable until this session reconnects/)).toBeTruthy()
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('missionId=m1'))).toBe(true))
    expect(await screen.findByText('A saved project review could not be loaded. Your saved work is unchanged.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review project' })).toBeTruthy()
    expect(screen.queryByText('This did not record')).toBeNull()
    expect(document.querySelector('section.sd')!.getAttribute('data-cognition')).not.toBe('failed')
  })

  it('the owner without a model key still restores confirmed lessons', async () => {
    const fetchMock = vi.fn(async (url: string) => String(url).includes('capabilities=1')
      ? respond(200, { configured: false })
      : respond(200, { review: null, lessons: [lesson] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<MissionTab />)

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('missionId=m1'))).toBe(true))
    expect(screen.queryByText(VISITOR_ACCESS_COPY)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Why this?' }))
    expect(await screen.findByText(lesson.rule)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review project' })).toBeTruthy()
  })

  it('a failed review restore for the owner is a quiet note, not "This did not record"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).includes('capabilities=1')
      ? respond(200, { configured: false })
      : respond(503, { error: 'Could not restore the project review. Your saved work is unchanged.' })))
    render(<MissionTab />)

    expect(await screen.findByText('A saved project review could not be loaded. Your saved work is unchanged.')).toBeTruthy()
    expect(screen.queryByText('This did not record')).toBeNull()
    expect(document.querySelector('section.sd')!.getAttribute('data-cognition')).not.toBe('failed')
  })
})


describe('MissionTab evidence after finish line exists', () => {
  const lined: Mission = {
    id: 'm1',
    title: 'Write the studio lighting reference',
    why: '',
    finishLine: 'The lighting reference is posted where the studio can use it',
    evidenceRequirement: null,
    state: 'primary',
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  }

  beforeEach(() => {
    inserts = []
    connectMissionSession.mockReset()
    connectMissionSession.mockResolvedValue({ id: 'user-1' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false }) })))
    tables = {
      missions: [{ ...missionToRow(lined, 'user-1'), created_at: lined.createdAt }],
      evidence_snapshots: [],
      actions: [],
      mission_events: [],
    }
  })

  it('lets a lined Primary name its evidence requirement later', async () => {
    render(<MissionTab />)
    fireEvent.click(await screen.findByText('Review your Primary mission'))
    const proof = await screen.findByLabelText('What will prove it is done')
    fireEvent.change(proof, { target: { value: 'A screenshot of the posted reference' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set proof' }))
    })
    await waitFor(() => expect(inserts.some(i => i.table === 'missions' && i.row.evidence_requirement === 'A screenshot of the posted reference')).toBe(true))
    const event = inserts.find(i => i.table === 'mission_events' && i.row.type === 'evidence_requirement_set')
    expect(event?.row.detail).toBe('A screenshot of the posted reference')
  })
})
