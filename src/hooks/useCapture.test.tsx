import { act, renderHook } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCapture } from './useCapture'
import { captureInboxKey, readCaptureInbox, writeCaptureInbox } from '@/lib/captureCache'

const db = vi.hoisted(() => ({ limit: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ order: () => ({ limit: db.limit }) }) }), upsert: db.upsert,
}) } }))
const source = { id: 'source', is_anonymous: false } as User
const destination = { id: 'destination', is_anonymous: true } as User
const secret = { id: 'capture-source', text: 'Private source account capture', timestamp: '2026-10-27', suggested: 'general' }

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  db.limit.mockResolvedValue({ data: [], error: null })
  db.upsert.mockResolvedValue({ error: null })
})

it('hides the previous account immediately and cannot force-upload its captures into an empty destination', async () => {
  writeCaptureInbox(source.id, [secret])
  const hook = renderHook(({ user }) => useCapture(user), { initialProps: { user: source } })
  await act(() => hook.result.current.loadCaptures(source.id))
  expect(hook.result.current.inbox).toEqual([secret])
  hook.rerender({ user: destination })
  expect(hook.result.current.inbox).toEqual([])
  await act(() => hook.result.current.loadCaptures(destination.id))
  expect(hook.result.current.inbox).toEqual([])
  await expect(hook.result.current.forceSyncItems([secret])).rejects.toThrow('another account')
  expect(db.upsert).not.toHaveBeenCalled()
  expect(readCaptureInbox(source.id)).toEqual([secret])
  expect(readCaptureInbox(destination.id)).toEqual([])
})

it('does not restore a signed-out account’s captures after a reload into a new anonymous account', async () => {
  writeCaptureInbox(source.id, [secret])
  const hook = renderHook(() => useCapture(destination))
  await act(() => hook.result.current.loadCaptures(destination.id))
  expect(hook.result.current.inbox).toEqual([])
  expect(localStorage.getItem(captureInboxKey(source.id))).toContain(secret.text)
})

it('preserves the same account’s unsynced captures on an empty cloud read', async () => {
  writeCaptureInbox(source.id, [secret])
  const hook = renderHook(() => useCapture(source))
  await act(() => hook.result.current.loadCaptures(source.id))
  expect(hook.result.current.inbox).toEqual([secret])
  expect(hook.result.current.syncedCaptureIds.size).toBe(0)
  await act(() => hook.result.current.forceSyncItems(hook.result.current.inbox))
  expect(db.upsert).toHaveBeenCalledWith([expect.objectContaining({ id: secret.id, user_id: source.id })], expect.anything())
})

it('still saves and syncs a newly captured item under the current account', async () => {
  const hook = renderHook(() => useCapture(source))
  await act(async () => { await hook.result.current.capture('A new code idea') })
  expect(hook.result.current.inbox).toHaveLength(1)
  expect(readCaptureInbox(source.id)[0].text).toBe('A new code idea')
  expect(db.upsert).toHaveBeenCalledWith([expect.objectContaining({ text: 'A new code idea', user_id: source.id })], expect.anything())
})

it('keeps failed-read local data scoped to its original account', async () => {
  writeCaptureInbox(source.id, [secret])
  db.limit.mockResolvedValue({ data: null, error: new Error('offline') })
  const hook = renderHook(() => useCapture(source))
  await act(async () => { await expect(hook.result.current.loadCaptures(source.id)).rejects.toThrow('offline') })
  expect(hook.result.current.inbox).toEqual([secret])
})
