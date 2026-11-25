/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import CodexLiveVoice, { liveVoiceActivityLabel } from './CodexLiveVoice'
import type { Mission } from '@/types'

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'owner-token' } } }),
    },
  },
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

const mission: Mission = {
  id: 'm1',
  title: 'Ship the print store',
  state: 'primary',
  why: 'Publish three prints',
  finishLine: 'One print ordered',
  evidenceRequirement: 'Order confirmation',
  blocker: null,
  capacityMismatch: false,
  createdAt: '2026-11-24T00:00:00Z',
  updatedAt: '2026-11-24T00:00:00Z',
}

type FakeChannel = {
  readyState: string
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  onmessage: ((event: { data: string }) => void) | null
  onclose: (() => void) | null
}

function setupLiveVoiceMocks(briefPayload: Record<string, unknown>) {
  const audioTrack = { enabled: true, stop: vi.fn() }
  const stream = {
    getAudioTracks: () => [audioTrack],
    getTracks: () => [audioTrack],
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  })

  let activeChannel: FakeChannel | null = null
  class FakePeerConnection {
    iceGatheringState = 'complete'
    connectionState = 'connected'
    localDescription: { sdp: string } | null = null
    ontrack: ((event: unknown) => void) | null = null
    onconnectionstatechange: (() => void) | null = null
    addTrack = vi.fn()
    createDataChannel = vi.fn(() => {
      activeChannel = {
        readyState: 'open',
        send: vi.fn(),
        close: vi.fn(),
        onmessage: null,
        onclose: null,
      }
      return activeChannel
    })
    createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'fake-offer' }))
    setLocalDescription = vi.fn(async (desc: { sdp: string }) => { this.localDescription = desc })
    setRemoteDescription = vi.fn(async () => {})
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    close = vi.fn()
  }
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/live-voice' && init?.method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    }
    if (url === '/api/live-voice' && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ id: 'sess-1', sdp: 'fake-answer' }) }
    }
    if (url === '/api/brief' && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => briefPayload }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    audioTrack,
    emit: (payload: Record<string, unknown>) => {
      activeChannel?.onmessage?.({ data: JSON.stringify(payload) })
    },
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('liveVoiceActivityLabel', () => {
  it('returns one concise truthful label per genuine state', () => {
    expect(liveVoiceActivityLabel('connecting', false)).toBe('Connecting…')
    expect(liveVoiceActivityLabel('listening', false)).toBe('Listening')
    expect(liveVoiceActivityLabel('listening', true)).toBe('Microphone muted')
    expect(liveVoiceActivityLabel('reasoning', false)).toBe('Codex is working')
    expect(liveVoiceActivityLabel('responding', false)).toBe('Codex speaking')
    expect(liveVoiceActivityLabel('interrupted', false)).toBe('Connection interrupted')
  })
})

describe('CodexLiveVoice orb-first experience', () => {
  it('hides transcript by default, renders Markdown cleanly on reveal, supports mute, and shows calm commitment-conflict sheet', async () => {
    const { audioTrack, emit } = setupLiveVoiceMocks({
      tier: 'routine',
      provider: 'gemini',
      model: 'gemini-4-hydrogen',
      text: '**Interpretation (proposed):** Focus on the three ready prints first.\n\n**Finish when:** All three print listings are live.\n\nNEXT ACTION: Publish the three print listings',
    })
    const onAnswer = vi.fn()
    const onPhaseChange = vi.fn()
    const onSaveAnswer = vi.fn(async () => ({
      ok: false,
      error: 'Conflict',
      conflict: {
        existingTitle: 'Upload three prints to the store',
        missionTitle: 'Ship the print store',
      },
    }))

    const { container } = render(
      <CodexLiveVoice
        missions={[mission]}
        primaryMissionId="m1"
        tier="routine"
        canSave
        onAnswer={onAnswer}
        onPhaseChange={onPhaseChange}
        onSaveAnswer={onSaveAnswer}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Talk live with Codex/ }))
    })
    act(() => {
      emit({ type: 'session.started' })
    })

    // Transcript curtain exists for smooth reveal but is hidden by default (orb-first).
    const transcript = container.querySelector('#live-voice-transcript')
    expect(transcript).toHaveAttribute('aria-hidden', 'true')
    expect(transcript).not.toHaveAttribute('data-open')

    // Mute toggles actual local microphone track without dropping the session.
    const muteBtn = screen.getByRole('button', { name: 'Mute microphone' })
    fireEvent.click(muteBtn)
    expect(audioTrack.enabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Unmute microphone' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }))
    expect(audioTrack.enabled).toBe(true)

    // Deliver a real transcript utterance + delegation so a response with Markdown & proposal arrives.
    act(() => {
      emit({ type: 'session.input_transcript.delta', delta: 'What should I do next?', start_ms: 0, end_ms: 400 })
      emit({ type: 'session.delegation.created', offset_ms: 500, delegation: { id: 'del-1', target: 'client' } })
    })

    // Wait for the 250ms fragment gather + /api/brief resolution.
    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledOnce())

    // Still orb-first: transcript stays hidden until explicitly opened; only subtle proposal pill appears.
    expect(transcript).not.toHaveAttribute('data-open')
    const proposalPill = screen.getByRole('button', { name: /Proposed action ready/ })
    expect(proposalPill).toBeInTheDocument()

    // Reveal transcript via accessible button: Markdown renders properly (no literal **).
    fireEvent.click(screen.getByRole('button', { name: /Transcript · 1/ }))
    expect(transcript).toHaveAttribute('data-open', 'true')
    const strong = within(transcript as HTMLElement).getByText('Interpretation (proposed):')
    expect(strong.tagName).toBe('STRONG')
    expect((transcript as HTMLElement).textContent).not.toContain('**Interpretation')

    // Return to orb via accessible button without ending the session.
    fireEvent.click(screen.getByRole('button', { name: /Back to orb/ }))
    expect(transcript).not.toHaveAttribute('data-open')
    expect(screen.getByRole('button', { name: 'End voice session' })).toBeInTheDocument()

    // Open compact Action Proposal sheet -> displays proposed action, why, finish condition, and calm conflict.
    fireEvent.click(proposalPill)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Proposed action · not saved')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Publish the three print listings' })).toBeInTheDocument()
    expect(within(dialog).getByText('Finish when')).toBeInTheDocument()
    expect(within(dialog).getAllByText('All three print listings are live.').length).toBeGreaterThanOrEqual(1)

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save as my next action' }))
    })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('You already have a saved next step for this mission. Nothing was overwritten.')
    expect(within(dialog).getByText('Existing saved action')).toBeInTheDocument()
    expect(within(dialog).getByText('Upload three prints to the store')).toBeInTheDocument()
  })
})
