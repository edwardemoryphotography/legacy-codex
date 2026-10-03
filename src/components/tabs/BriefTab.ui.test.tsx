/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BriefTab, { BRIEF_VISITOR_COPY } from './BriefTab'

vi.mock('@/lib/supabase/missionSession', () => ({
  connectMissionSession: async () => ({ id: 'visitor-1' }),
  missionConnectionMessage: () => 'Could not open a session.',
}))

const missionRow = {
  id: 'mission-1', user_id: 'visitor-1', title: 'UI test mission', state: 'active', why: 'Exercise the Brief tab',
  finish_line: null, evidence_requirement: null, blocker: null, capacity_mismatch: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: 'visitor-token' } }, error: null }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [missionRow], error: null }) }) }),
  },
}))

describe('BriefTab visitor boundary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST'
      ? { ok: false, status: 403, json: async () => ({ error: 'Model-assisted candidates are not enabled for this account.' }) }
      : { ok: true, status: 200, json: async () => ({ configured: true }) }))
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
})
