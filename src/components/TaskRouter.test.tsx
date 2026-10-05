import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import TaskRouter from './TaskRouter'
import type { NextMoveContext } from '@/types'

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: 'user-1' } } }, error: null })),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession } },
}))

const context: NextMoveContext = { mission: null, missionStatus: 'unavailable', evidence: [], evidenceStatus: 'unavailable' }
const intent = 'Implement the Codex Control Panel design and task-routing experience into Legacy Codex Strategic Delta, preserving project context, evidence, corrections, and pause/reload/resume continuity.'
const props = { context, accountId: null, seed: null, canSave: false, onPrepare: () => {} }
afterEach(cleanup)
beforeEach(() => {
  localStorage.clear()
  getSession.mockClear()
  vi.unstubAllGlobals()
})

describe('TaskRouter with real supplied intent and unavailable account context', () => {
  it('engages the spectrum immediately on focus and settles when focus leaves', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.focus(input)
    expect(input.closest('.route-composer')?.getAttribute('data-engaged')).toBe('true')
    fireEvent.blur(input)
    expect(input.closest('.route-composer')?.getAttribute('data-engaged')).toBeNull()
  })

  it('keeps actual typed intent when speech recognition is unavailable', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.change(input, { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Start voice input' }))
    expect(screen.getByText(/Voice input is not available in this browser/)).not.toBeNull()
    expect((input as HTMLTextAreaElement).value).toBe(intent)
    expect(screen.getByRole('button', { name: 'Start voice input' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })
  it('prepares a handoff without pretending an unavailable mission or tool has run', () => {
    render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Status: not started')
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Mission read: unavailable')
    expect(screen.queryByRole('button', { name: 'Prepare saved action' })).toBeNull()
  })

  it('never revives an invalidated route after editing the task back', () => {
    render(<TaskRouter {...props} />)
    const input = screen.getByRole('textbox', { name: 'Task to route' })
    fireEvent.change(input, { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    fireEvent.change(input, { target: { value: 'Proceed' } })
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    fireEvent.change(input, { target: { value: intent } })
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })

  it('invalidates on changed context and keeps the human draft intact', () => {
    const { rerender } = render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    rerender(<TaskRouter {...props} context={{ ...context, missionStatus: 'loading' }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    expect((screen.getByRole('textbox', { name: 'Task to route' }) as HTMLTextAreaElement).value).toBe(intent)
    rerender(<TaskRouter {...props} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })

  it('applies the chosen correction and explicitly describes session-only learning', () => {
    render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Correct routing lane' }), { target: { value: 'architecture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use this lane' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Plan & architecture')
    expect(screen.getByRole('status', { name: 'Routing status' }).textContent).toContain('Correction applied for this session')
  })

  it('invalidates a handoff when human project context or a Delta correction changes', () => {
    const { rerender } = render(<TaskRouter {...props} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: intent } })
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    // Eddie's actual correction of the product direction in this session.
    const note = 'I feel like we’ve gotten too far away from this.'
    rerender(<TaskRouter {...props} context={{ ...context, contextNotes: [note] }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain(note)
    rerender(<TaskRouter {...props} context={{ ...context, contextNotes: [note], corrections: [{ correctedMove: intent, reason: note }] }} />)
    expect(screen.queryByRole('article', { name: 'Task route' })).toBeNull()
  })
})

describe('TaskRouter account correction reconciliation', () => {
  const mission = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Keep the studio calendar accurate',
    why: 'The team needs one source of truth.',
    finishLine: 'The current schedule is published.',
    evidenceRequirement: null,
    state: 'primary' as const,
    blocker: null,
    capacityMismatch: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  }
  const accountContext: NextMoveContext = { mission, missionStatus: 'ready', evidence: [], evidenceStatus: 'ready' }
  const accountProps = { ...props, context: accountContext, accountId: 'user-1' }
  const task = 'Update studio calendar'

  it('keeps an unacknowledged correction across focus refresh and remount', async () => {
    let reads = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, json: async () => ({ error: 'write response lost' }) }
      reads += 1
      return { ok: true, json: async () => ({ userId: 'user-1', missionId: mission.id, lessons: [], weights: {}, savedCorrectionId: null }) }
    }))

    const view = render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    teachArchitecture(task)
    expect(await screen.findByText(/Correction is browser-only/)).toBeTruthy()

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(reads).toBe(2))
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    routeCurrentTask()
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Plan & architecture')

    view.unmount()
    render(<TaskRouter {...accountProps} />)
    await waitFor(() => expect(reads).toBe(3))
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: task } })
    routeCurrentTask()
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Plan & architecture')
  })

  it('removes the overlay only when the server confirms its exact correction id', async () => {
    let correctionId: string | null = null
    let acknowledged = false
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        correctionId = JSON.parse(String(init.body)).idempotencyKey
        return { ok: false, json: async () => ({ error: 'write response lost' }) }
      }
      const weights = acknowledged ? {
        update: { execution: 5, architecture: 4 },
        studio: { execution: 5, architecture: 4 },
        calendar: { execution: 5, architecture: 4 },
      } : {}
      return { ok: true, json: async () => ({
        userId: 'user-1', missionId: mission.id, lessons: [], weights,
        savedCorrectionId: acknowledged ? correctionId : null,
      }) }
    }))

    render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    teachArchitecture(task)
    expect(await screen.findByText(/Correction is browser-only/)).toBeTruthy()
    expect(correctionId).toMatch(/^[0-9a-f-]{36}$/)
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(Boolean).some(key => key!.includes('pending-route-correction'))).toBe(true)

    acknowledged = true
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    await waitFor(() => expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(Boolean).some(key => key!.includes('pending-route-correction'))).toBe(false))
    routeCurrentTask()
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Build & implement')
  })

  it('reconciles the original correction id after switching to another mission', async () => {
    let correctionId: string | null = null
    let committed = false
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        correctionId = JSON.parse(String(init.body)).idempotencyKey
        committed = true
        return { ok: false, json: async () => ({ error: 'response lost after commit' }) }
      }
      const params = new URL(String(url), 'https://legacy-codex.vercel.app').searchParams
      const acknowledged = committed && params.get('correctionId') === correctionId && params.get('correctionMissionId') === mission.id
      const weights = committed ? {
        update: { execution: 5, architecture: 4 },
        studio: { execution: 5, architecture: 4 },
        calendar: { execution: 5, architecture: 4 },
      } : {}
      return { ok: true, json: async () => ({
        userId: 'user-1', missionId: params.get('missionId'), lessons: [], weights,
        savedCorrectionId: acknowledged ? correctionId : null,
      }) }
    }))

    const view = render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    teachArchitecture(task)
    expect(await screen.findByText(/Correction is browser-only/)).toBeTruthy()

    const otherMission = { ...mission, id: '22222222-2222-4222-8222-222222222222', title: 'Prepare the print order' }
    view.rerender(<TaskRouter {...accountProps} context={{ ...accountContext, mission: otherMission }} />)
    await waitFor(() => expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(Boolean).some(key => key!.includes('pending-route-correction'))).toBe(false))
    routeCurrentTask()
    expect(screen.getByRole('article', { name: 'Task route' }).textContent).toContain('Build & implement')
  })

  it('does not promise persistence when a task has no learnable route tokens', async () => {
    let posts = 0
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { posts += 1; return { ok: false, json: async () => ({}) } }
      return { ok: true, json: async () => ({ userId: 'user-1', missionId: mission.id, lessons: [], weights: {}, savedCorrectionId: null }) }
    }))

    render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    teachArchitecture('Fix UI')
    expect(await screen.findByText(/at least one specific word with four or more characters/i)).toBeTruthy()
    expect(posts).toBe(0)
    expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(Boolean).some(key => key!.includes('pending-route-correction'))).toBe(false)
  })

  it('retries the stored payload with the same id after a full remount', async () => {
    const postBodies: Array<Record<string, unknown>> = []
    let acceptRetry = false
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body)))
        return { ok: acceptRetry, json: async () => acceptRetry ? { weights: {} } : { error: 'offline' } }
      }
      return { ok: true, json: async () => ({ userId: 'user-1', missionId: mission.id, lessons: [], weights: {}, savedCorrectionId: null }) }
    }))

    const view = render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    teachArchitecture(task)
    expect(await screen.findByText(/Correction is browser-only/)).toBeTruthy()
    const first = postBodies[0]

    view.unmount()
    acceptRetry = true
    render(<TaskRouter {...accountProps} />)
    await screen.findByText('Saved lessons and account routing corrections loaded.')
    fireEvent.click(await screen.findByRole('button', { name: 'Retry account save' }))
    await waitFor(() => expect(postBodies).toHaveLength(2))
    expect(postBodies[1]).toEqual(first)
    await waitFor(() => expect([...Array(localStorage.length)].map((_, index) => localStorage.key(index)).filter(Boolean).some(key => key!.includes('pending-route-correction'))).toBe(false))
  })
})

function routeCurrentTask() {
  fireEvent.click(screen.getByRole('button', { name: 'Route task' }))
}

function teachArchitecture(task: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Task to route' }), { target: { value: task } })
  routeCurrentTask()
  fireEvent.change(screen.getByRole('combobox', { name: 'Correct routing lane' }), { target: { value: 'architecture' } })
  fireEvent.click(screen.getByRole('button', { name: 'Use this lane' }))
}
