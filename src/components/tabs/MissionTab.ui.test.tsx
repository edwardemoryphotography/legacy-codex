/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissionTab, { missionToRow } from './MissionTab'
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

function chain(data: unknown[] = [], error: unknown = null) {
  const promise = Promise.resolve({ data: error ? null : data, error })
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
      ...chain(tables[table] ?? [], failNext[table] ? (failNext[table] = false, { message: 'read failed' }) : null),
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

let tables: Record<string, unknown[]> = {}
let failNext: Record<string, boolean> = {}
let inserts: Array<{ table: string, row: Record<string, unknown> }> = []

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
    expect(screen.getByRole('button', { name: 'This is what matters' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'From idea to saved action' })).toBeTruthy()
    expect(screen.queryByText('Nothing parked.')).toBeNull()
    expect(screen.queryByText('Secondary Mission (none active)')).toBeNull()
    expect(screen.getByText('Park an idea you are not ready to commit')).toBeTruthy()
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
})
