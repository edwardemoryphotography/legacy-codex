/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TerritoryTab, { EVENTS_READ_FAILED_COPY } from './TerritoryTab'

vi.mock('@/lib/supabase/missionSession', () => ({
  connectMissionSession: async () => ({ id: 'owner-1' }),
  missionConnectionMessage: () => 'Could not open a session.',
}))

// Test-only table rows: they exercise the layout, they are not saved account data.
const db = vi.hoisted(() => ({
  missions: [] as Record<string, unknown>[],
  actions: { data: [] as Record<string, unknown>[], error: null as unknown },
  events: { data: [] as Record<string, unknown>[], error: null as unknown },
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'token' } }, error: null }) },
    from: (table: string) => table === 'actions'
      ? { select: () => ({ not: () => ({ neq: async () => db.actions }) }) }
      : table === 'mission_events'
        ? { select: () => ({ eq: () => ({ order: () => ({ limit: async () => db.events }) }) }) }
        : { select: () => ({ eq: async () => ({ data: db.missions, error: null }) }) },
  },
}))

const row = (overrides: Record<string, unknown>) => ({
  id: 'm1', user_id: 'owner-1', title: 'Primary mission', state: 'primary', why: '', finish_line: null, evidence_requirement: null,
  blocker: null, capacity_mismatch: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', ...overrides,
})

function stubFetch(postBody: unknown = { text: 'A grounded answer.' }) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: true, status: 200, json: async () => postBody }
    : { ok: true, status: 200, json: async () => ({ configured: true }) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('TerritoryTab', () => {
  beforeEach(() => {
    db.missions = []
    db.actions = { data: [], error: null }
    db.events = { data: [], error: null }
    stubFetch()
  })

  it('shows Unknown instead of inventing anything when no missions are saved', async () => {
    render(<TerritoryTab />)
    expect(await screen.findByText(/Unknown: nothing saved yet — add a mission in Mission first/)).toBeTruthy()
  })

  it('groups missions with their real state, and builds Active State from saved data', async () => {
    db.missions = [
      row({ capacity_mismatch: true, finish_line: 'Prints shipped' }),
      row({ id: 'm2', title: 'Smaller mission', state: 'secondary' }),
      row({ id: 'm3', title: 'Parked idea', state: 'parked' }),
    ]
    db.actions = { data: [{ id: 'a1', mission_id: 'm1', action_title: 'Email the lab', status: 'TODO', resume_note: null }], error: null }
    db.events = { data: [{ mission_id: 'm1', type: 'capacity_mismatch_reported', detail: 'reported capacity: low', created_at: '2026-01-03T00:00:00Z' }], error: null }
    render(<TerritoryTab />)
    expect(await screen.findByText(/low — mismatch reported/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Active/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Paused/ })).toBeTruthy()
    expect(screen.getByText('parked')).toBeTruthy()
    expect(screen.getAllByText('Email the lab (TODO)').length).toBe(2)
    expect(screen.getByText(/your Secondary is the one to work on/).textContent).toContain('Smaller mission')
  })

  it('opens a detail panel whose buttons send only that mission', async () => {
    db.missions = [row({ blocker: 'waiting on lab' }), row({ id: 'm2', title: 'Other mission', state: 'secondary' })]
    const fetchMock = stubFetch()
    render(<TerritoryTab />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Primary mission' }))
    const breakWall = screen.getByRole('button', { name: 'Break Wall' })
    await waitFor(() => expect((breakWall as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Triage' }))
    expect(await screen.findByText('A grounded answer.')).toBeTruthy()
    expect(screen.getByText('Triage · Primary mission')).toBeTruthy()
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body))
    expect(body).toMatchObject({ mode: 'triage', missionIds: ['m1'] })
    expect(body.missions).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '← All missions' }))
    expect(screen.queryByText('A grounded answer.')).toBeNull()
  })

  it('says history and actions could not be read instead of showing them as empty', async () => {
    db.missions = [row({})]
    db.actions = { data: [], error: { message: 'network' } }
    db.events = { data: [], error: { message: 'network' } }
    render(<TerritoryTab />)
    expect(await screen.findByText(EVENTS_READ_FAILED_COPY)).toBeTruthy()
    const card = screen.getByRole('button', { name: 'Open Primary mission' })
    expect(within(card).getByText('could not be read')).toBeTruthy()
  })
})
