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
