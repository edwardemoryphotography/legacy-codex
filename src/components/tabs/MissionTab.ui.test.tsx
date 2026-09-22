/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissionTab from './MissionTab'

vi.mock('@/components/ActivityOrb', () => ({
  default: () => null,
}))

const connectMissionSession = vi.fn()

vi.mock('@/lib/supabase/missionSession', () => ({
  connectMissionSession: () => connectMissionSession(),
  missionConnectionMessage: () => 'This version could not open a session. Use the main Legacy Codex site, then try again.',
}))

function chain(data: unknown[] = []) {
  const promise = Promise.resolve({ data, error: null })
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
    from: () => chain(),
  },
}))

describe('MissionTab first-run presentation', () => {
  beforeEach(() => {
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
