/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BriefTab, { ACTIONS_READ_FAILED_COPY, BRIEF_VISITOR_COPY } from './BriefTab'

vi.mock('@/lib/supabase/missionSession', () => ({
  connectMissionSession: async () => ({ id: 'visitor-1' }),
  missionConnectionMessage: () => 'Could not open a session.',
}))

const missionRow = {
  id: 'mission-1', user_id: 'visitor-1', title: 'UI test mission', state: 'active', why: 'Exercise the Brief tab',
  finish_line: null, evidence_requirement: null, blocker: null, capacity_mismatch: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

// Test-only table rows: they exercise the picker, they are not saved account data.
const db = vi.hoisted(() => ({ missions: [] as Record<string, unknown>[], actions: { data: [] as Record<string, unknown>[], error: null as unknown } }))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'visitor-token' } }, error: null }) },
    from: (table: string) => table === 'actions'
      ? { select: () => ({ not: () => ({ neq: async () => db.actions }) }) }
      : { select: () => ({ eq: async () => ({ data: db.missions, error: null }) }) },
  },
}))

function stubFetch(postStatus: number, postBody: unknown) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: postStatus < 400, status: postStatus, json: async () => postBody }
    : { ok: true, status: 200, json: async () => ({ configured: true }) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('BriefTab visitor boundary', () => {
  beforeEach(() => {
    db.missions = [missionRow]
    db.actions = { data: [], error: null }
    stubFetch(403, { error: 'Model-assisted candidates are not enabled for this account.' })
  })

  it('shows a visitor plain copy on 403 instead of an error, and stops offering the brief', async () => {
    render(<BriefTab />)
    const button = await screen.findByRole('button', { name: 'Daily Brief' })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(button)

    expect(await screen.findByText(BRIEF_VISITOR_COPY)).toBeTruthy()
    expect(screen.queryByText(/not enabled for this account/i)).toBeNull()
    expect(screen.queryByText(/failed/i)).toBeNull()
    expect((screen.getByRole('button', { name: 'Daily Brief' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps Architect Scan and Break Wall off for a visitor too', async () => {
    db.missions = [{ ...missionRow, blocker: 'stuck' }]
    render(<BriefTab />)
    const scan = await screen.findByRole('button', { name: 'Architect Scan' })
    await waitFor(() => expect((scan as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(scan)
    expect(await screen.findByText(BRIEF_VISITOR_COPY)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Architect Scan' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Break Wall' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('BriefTab Architect Scan and Break Wall', () => {
  beforeEach(() => {
    db.missions = [missionRow]
    db.actions = { data: [], error: null }
  })

  it('disables Break Wall with Unknown copy when nothing is saved to break', async () => {
    stubFetch(200, { text: 'ok' })
    render(<BriefTab />)
    expect(await screen.findByText(/needs a saved blocker or unfinished action/i)).toBeTruthy()
    expect(screen.getByText(/Unknown: nothing saved yet/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Break Wall' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers the saved blocker and unfinished action, and sends only the chosen mission and wall', async () => {
    db.missions = [{ ...missionRow, blocker: 'waiting on lab' }, { ...missionRow, id: 'mission-2', title: 'Second mission' }]
    db.actions = { data: [{ id: 'a1', mission_id: 'mission-1', action_title: 'Email the lab', status: 'TODO', resume_note: null }], error: null }
    const fetchMock = stubFetch(200, { text: 'Open the lab order page.' })
    render(<BriefTab />)
    const wall = await screen.findByLabelText('Wall to break')
    fireEvent.change(wall, { target: { value: 'action' } })
    const button = screen.getByRole('button', { name: 'Break Wall' })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(button)
    expect(await screen.findByText('Open the lab order page.')).toBeTruthy()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    const body = JSON.parse(String(post[1]!.body))
    expect(body.mode).toBe('unblock')
    expect(body.missionIds).toEqual(['mission-1'])
    expect(body.missions).toHaveLength(1)
    expect(body.target).toMatchObject({ kind: 'action', action: { title: 'Email the lab', status: 'TODO' } })
  })

  it('says unfinished actions could not be read instead of claiming none exist', async () => {
    db.missions = [{ ...missionRow, blocker: 'waiting on lab' }]
    db.actions = { data: [], error: { message: 'network' } }
    stubFetch(200, { text: 'ok' })
    render(<BriefTab />)
    expect(await screen.findByText(ACTIONS_READ_FAILED_COPY)).toBeTruthy()
    expect(screen.getByText(/uses the saved blocker: waiting on lab/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Architect Scan' }) as HTMLButtonElement).disabled).toBe(true)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Break Wall' }) as HTMLButtonElement).disabled).toBe(false))
  })
})
