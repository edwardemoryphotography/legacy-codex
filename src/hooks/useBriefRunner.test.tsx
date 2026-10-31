import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useBriefRunner } from './useBriefRunner'

vi.mock('@/lib/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// HTTP failure contracts only. No invented provider answer or successful AI run.
it('returns failure on a denied account so the composer can retain the draft', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ json: async () => ({ configured: true }) }).mockResolvedValueOnce({ status: 403 }))
  const { result } = renderHook(() => useBriefRunner())
  await waitFor(() => expect(result.current.configured).toBe(true))
  await act(async () => expect(await result.current.run('question', { missions: [], question: 'this text box doesnt even let me send it anywhere' })).toBe(false))
  expect(result.current.visitor).toBe(true)
})

it('returns failure with the server error instead of telling the composer to clear its text', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ json: async () => ({ configured: true }) }).mockResolvedValueOnce({ status: 503, ok: false, json: async () => ({ error: 'Daily Brief unavailable' }) }))
  const { result } = renderHook(() => useBriefRunner())
  await waitFor(() => expect(result.current.configured).toBe(true))
  await act(async () => expect(await result.current.run('question', { missions: [] })).toBe(false))
  expect(result.current.status).toBe('error')
  expect(result.current.output).toBe('Daily Brief unavailable')
})

it('does not treat an empty provider answer as a successful send', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ json: async () => ({ configured: true }) }).mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ text: '' }) }))
  const { result } = renderHook(() => useBriefRunner())
  await waitFor(() => expect(result.current.configured).toBe(true))
  await act(async () => expect(await result.current.run('question', { missions: [] })).toBe(false))
  expect(result.current.status).toBe('error')
})
