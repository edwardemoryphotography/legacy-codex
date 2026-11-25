/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import CodexLiveVoice, { inspectMicrophoneStream, liveVoiceActivityLabel, transportBillingSummary, VOICE_ENDED_MESSAGE, type LiveVoiceSnapshot } from './CodexLiveVoice'
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
  onopen: (() => void) | null
  onclose: (() => void) | null
}

function setupLiveVoiceMocks(briefPayload: Record<string, unknown>) {
  const listeners = new Map<string, Set<() => void>>()
  const audioTrack = {
    enabled: true,
    muted: false,
    readyState: 'live',
    stop: vi.fn(() => { audioTrack.readyState = 'ended' }),
    addEventListener: vi.fn((name: string, fn: () => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name)!.add(fn)
    }),
    removeEventListener: vi.fn((name: string, fn: () => void) => {
      listeners.get(name)?.delete(fn)
    }),
  }
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
    static last: FakePeerConnection | null = null
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
        onopen: null,
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
    constructor() { FakePeerConnection.last = this }
  }
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)

  const briefBodies: Array<Record<string, unknown>> = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/live-voice' && init?.method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    }
    if (url === '/api/live-voice' && init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ id: 'sess-1', sdp: 'fake-answer' }) }
    }
    if (url === '/api/brief' && init?.method === 'POST') {
      briefBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return { ok: true, status: 200, json: async () => briefPayload }
    }
    return { ok: true, status: 200, json: async () => ({}) }
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    audioTrack,
    briefBodies,
    fetchMock,
    peer: () => FakePeerConnection.last,
    getChannel: () => activeChannel,
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

describe('liveVoiceActivityLabel & transport/mic helpers', () => {
  it('returns concise truthful labels per genuine state', () => {
    expect(liveVoiceActivityLabel('connecting', false)).toBe('Connecting…')
    expect(liveVoiceActivityLabel('listening', false)).toBe('Listening')
    expect(liveVoiceActivityLabel('listening', true)).toBe('Microphone muted')
    expect(liveVoiceActivityLabel('reasoning', false)).toBe('Codex is working')
    expect(liveVoiceActivityLabel('responding', false)).toBe('Codex speaking')
    expect(liveVoiceActivityLabel('responding', true)).toBe('Audio muted')
    expect(liveVoiceActivityLabel('interrupted', false)).toBe('Connection interrupted')
  })

  it('derives micLive strictly from MediaStreamTrack readyState/enabled/muted', () => {
    const liveTrack = { readyState: 'live', enabled: true, muted: false }
    const disabledTrack = { readyState: 'live', enabled: false, muted: false }
    const hwMutedTrack = { readyState: 'live', enabled: true, muted: true }
    const endedTrack = { readyState: 'ended', enabled: true, muted: false }
    expect(inspectMicrophoneStream({ getAudioTracks: () => [liveTrack] } as unknown as MediaStream)).toEqual({ micLive: true, micState: 'live' })
    expect(inspectMicrophoneStream({ getAudioTracks: () => [disabledTrack] } as unknown as MediaStream)).toEqual({ micLive: false, micState: 'muted' })
    expect(inspectMicrophoneStream({ getAudioTracks: () => [hwMutedTrack] } as unknown as MediaStream)).toEqual({ micLive: false, micState: 'muted' })
    expect(inspectMicrophoneStream({ getAudioTracks: () => [endedTrack] } as unknown as MediaStream)).toEqual({ micLive: false, micState: 'unavailable' })
    expect(inspectMicrophoneStream(null)).toEqual({ micLive: false, micState: 'unavailable' })
  })

  it('distinguishes connecting, connected, interrupted and terminated transport billing states', () => {
    expect(transportBillingSummary('connecting')).toContain('not yet live')
    expect(transportBillingSummary('connected')).toContain('metered while connected')
    expect(transportBillingSummary('interrupted')).toContain('reconnecting')
    expect(transportBillingSummary('terminated')).toContain('ended')
  })
})

describe('CodexLiveVoice orb-first experience & PR #210 review fixes', () => {
  it('keeps micLive truthful across phases, records authoritative direct turns into backend reasoning context, and never opens transcript automatically', async () => {
    const { audioTrack, briefBodies, emit, getChannel } = setupLiveVoiceMocks({
      tier: 'routine',
      provider: 'gemini',
      model: 'gemini-4-hydrogen',
      text: '**Interpretation (proposed):** Focus on the three ready prints first.\n\n**Finish when:** All three print listings are live.\n\nNEXT ACTION: Publish the three print listings',
    })
    const onAnswer = vi.fn()
    const onPhaseChange = vi.fn()
    const snapshots: LiveVoiceSnapshot[] = []
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
        initialEntries={[{
          question: 'Recovered earlier question',
          text: 'Recovered earlier answer',
          provider: 'Economy · Gemini',
          actionTitle: null,
          finishWhen: null,
        }]}
        onAnswer={onAnswer}
        onPhaseChange={onPhaseChange}
        onSnapshotChange={snap => snapshots.push(snap)}
        onSaveAnswer={onSaveAnswer}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Talk live with Codex/ }))
    })

    // Before session.started, transportState is connecting (NOT connected/billed).
    expect(snapshots.at(-1)?.transportState).toBe('connecting')
    expect(snapshots.at(-1)?.suppliedMessages).toBe(0)

    act(() => {
      emit({ type: 'session.started' })
    })

    // Connected, micLive true from actual track, and advisory recovery note sent to direct live channel.
    expect(snapshots.at(-1)?.transportState).toBe('connected')
    expect(snapshots.at(-1)?.micLive).toBe(true)
    expect(snapshots.at(-1)?.micState).toBe('live')
    expect(snapshots.at(-1)?.recoveredExchanges).toBe(1)
    expect(snapshots.at(-1)?.directRecoveryAdvisorySent).toBe(true)
    expect(getChannel()?.send).toHaveBeenCalledWith(expect.stringContaining('Recovered unverified prior conversation'))

    // Transcript stays hidden by default (orb-first).
    const transcript = container.querySelector('#live-voice-transcript')
    expect(transcript).toHaveAttribute('aria-hidden', 'true')
    expect(transcript).not.toHaveAttribute('data-open')

    // Partial output delta without authoritative completion MUST NOT be committed as a completed exchange.
    act(() => {
      emit({ type: 'session.input_transcript.delta', delta: 'Quick direct question', start_ms: 0, end_ms: 200 })
      emit({ type: 'session.output_transcript.delta', delta: 'Direct spoken reply.' })
    })
    // Still only 1 recovered exchange (partial delta not committed yet).
    expect(snapshots.at(-1)?.retainedExchanges).toBe(1)
    // Even while responding, micLive stays true because track is still enabled & live.
    expect(snapshots.at(-1)?.micLive).toBe(true)
    expect(snapshots.at(-1)?.micState).toBe('live')

    // The only supported completion boundary is a new spoken turn: it commits
    // the previous direct exchange into entries AND reasoning context.
    act(() => {
      emit({ type: 'session.input_transcript.delta', delta: 'What should I do next?', start_ms: 300, end_ms: 600 })
    })
    await vi.waitFor(() => expect(snapshots.at(-1)?.retainedExchanges).toBe(2))

    // A continuation of the same turn must not duplicate the committed exchange.
    act(() => {
      emit({ type: 'session.input_transcript.delta', delta: ' please', start_ms: 700, end_ms: 750 })
    })
    await vi.waitFor(() => expect(snapshots.at(-1)?.retainedExchanges).toBe(2))

    // Mute toggles actual track without dropping session.
    fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }))
    expect(audioTrack.enabled).toBe(false)
    expect(snapshots.at(-1)?.micLive).toBe(false)
    expect(snapshots.at(-1)?.micState).toBe('muted')
    fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }))
    expect(audioTrack.enabled).toBe(true)
    expect(snapshots.at(-1)?.micLive).toBe(true)

    // Delegated turn receives BOTH recovered turn AND completed direct turn in conversation payload.
    act(() => {
      emit({ type: 'session.delegation.created', offset_ms: 800, delegation: { id: 'del-1', target: 'client' } })
    })

    await vi.waitFor(() => expect(onAnswer).toHaveBeenCalledOnce())
    expect(briefBodies).toHaveLength(1)
    const sentConversation = briefBodies[0].conversation as Array<{ role: string; text: string }>
    expect(sentConversation).toEqual([
      { role: 'user', text: 'Recovered earlier question' },
      { role: 'assistant', text: 'Recovered earlier answer' },
      { role: 'user', text: 'Quick direct question' },
      { role: 'assistant', text: 'Direct spoken reply.' },
    ])
    // suppliedMessages equals the actual count sent (4), never calculated as retained * 2 (6).
    await vi.waitFor(() => expect(snapshots.at(-1)?.suppliedMessages).toBe(4))
    expect(snapshots.at(-1)?.retainedExchanges).toBe(3)

    // Still orb-first after multiple reciprocal turns: transcript NEVER auto-opened.
    expect(transcript).not.toHaveAttribute('data-open')
    const proposalPill = screen.getByRole('button', { name: /Proposed action ready/ })
    expect(proposalPill).toBeInTheDocument()

    // Explicit Transcript open renders Markdown properly and discloses recovery boundary truthfully.
    fireEvent.click(screen.getByRole('button', { name: /Transcript · 3/ }))
    expect(transcript).toHaveAttribute('data-open', 'true')
    expect(within(transcript as HTMLElement).getByText(/no server-side audio session resume/i)).toBeInTheDocument()
    const strong = within(transcript as HTMLElement).getByText('Interpretation (proposed):')
    expect(strong.tagName).toBe('STRONG')
    expect((transcript as HTMLElement).textContent).not.toContain('**Interpretation')

    // Return to orb explicitly without ending session.
    fireEvent.click(screen.getByRole('button', { name: /Back to orb/ }))
    expect(transcript).not.toHaveAttribute('data-open')
    expect(screen.getByRole('button', { name: 'End voice session' })).toBeInTheDocument()

    // Compact Action Proposal sheet preserves confirmation & calm conflict UX.
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

describe('PR #210 behavioral integrity acceptance', () => {
  const payload = { tier: 'routine', provider: 'gemini', model: 'gemini-4-hydrogen', text: 'Answer.' }

  async function boot(setup: ReturnType<typeof setupLiveVoiceMocks>, props: Record<string, unknown> = {}) {
    const onAnswer = vi.fn()
    const onPhaseChange = vi.fn()
    const onSnapshotChange = vi.fn()
    const onEntriesChange = vi.fn()
    render(<CodexLiveVoice missions={[mission]} primaryMissionId="m1" tier="routine"
      onAnswer={onAnswer} onPhaseChange={onPhaseChange} onSnapshotChange={onSnapshotChange}
      onEntriesChange={onEntriesChange} {...props} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Talk live with Codex/ })) })
    act(() => { setup.emit({ type: 'session.started' }) })
    return { onAnswer, onPhaseChange, onSnapshotChange, onEntriesChange }
  }

  it('retains a recovered partial transcript but excludes it from backend reasoning', async () => {
    const setup = setupLiveVoiceMocks(payload)
    await boot(setup, { initialEntries: [
      { question: 'PARTIAL-Q', text: 'PARTIAL-A', provider: 'Live voice', actionTitle: null, finishWhen: null, partial: true, source: 'direct' },
    ] })
    act(() => {
      setup.emit({ type: 'session.input_transcript.delta', delta: 'NEXT-Q', start_ms: 0, end_ms: 100 })
      setup.emit({ type: 'session.delegation.created', offset_ms: 200, delegation: { id: 'del-p', target: 'client' } })
    })
    await vi.waitFor(() => expect(setup.briefBodies).toHaveLength(1))
    const conversation = setup.briefBodies[0].conversation as Array<{ text: string }>
    expect(conversation.some(message => message.text.includes('PARTIAL-Q') || message.text.includes('PARTIAL-A'))).toBe(false)
  })

  it('keeps repeated identical questions as distinct exchanges', async () => {
    const setup = setupLiveVoiceMocks(payload)
    const { onEntriesChange } = await boot(setup)
    act(() => {
      setup.emit({ type: 'session.input_transcript.delta', delta: 'SAME?', start_ms: 0, end_ms: 100 })
      setup.emit({ type: 'session.output_transcript.delta', delta: 'FIRST-A' })
      setup.emit({ type: 'session.input_transcript.delta', delta: 'SAME?', start_ms: 1000, end_ms: 1100 })
      setup.emit({ type: 'session.output_transcript.delta', delta: 'SECOND-A' })
      setup.emit({ type: 'session.input_transcript.delta', delta: 'NEXT', start_ms: 2000, end_ms: 2100 })
    })
    const saved = onEntriesChange.mock.calls.at(-1)?.[0] as Array<{ question: string; text: string }>
    expect(saved.filter(entry => entry.question === 'SAME?')).toHaveLength(2)
    expect(saved.map(entry => entry.text)).toEqual(expect.arrayContaining(['FIRST-A', 'SECOND-A']))
  })

  it('updates connection telemetry on interruption and recovery', async () => {
    const setup = setupLiveVoiceMocks(payload)
    const { onSnapshotChange } = await boot(setup)
    const peer = setup.peer()!
    act(() => { setup.getChannel()?.onopen?.() })
    act(() => { peer.connectionState = 'disconnected'; peer.onconnectionstatechange?.() })
    await vi.waitFor(() => expect(onSnapshotChange.mock.calls.at(-1)?.[0].connected).toBe(false))
    expect(onSnapshotChange.mock.calls.at(-1)?.[0].transportState).toBe('interrupted')
    act(() => { peer.connectionState = 'connected'; peer.onconnectionstatechange?.() })
    await vi.waitFor(() => expect(onSnapshotChange.mock.calls.at(-1)?.[0].connected).toBe(true))
  })

  it('explicit End clears the transcript and reasoning without another session', async () => {
    const setup = setupLiveVoiceMocks(payload)
    const { onEntriesChange } = await boot(setup)
    act(() => {
      setup.emit({ type: 'session.input_transcript.delta', delta: 'Q', start_ms: 0, end_ms: 100 })
      setup.emit({ type: 'session.output_transcript.delta', delta: 'A' })
      setup.emit({ type: 'session.input_transcript.delta', delta: 'NEXT', start_ms: 1000, end_ms: 1100 })
    })
    expect(onEntriesChange.mock.calls.at(-1)?.[0]).toHaveLength(1)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'End voice session' })) })
    expect(onEntriesChange.mock.calls.at(-1)?.[0]).toEqual([])
    expect(screen.getByRole('status')).toHaveTextContent(VOICE_ENDED_MESSAGE)
    expect(VOICE_ENDED_MESSAGE.length).toBeLessThan(90)
    expect(VOICE_ENDED_MESSAGE).toMatch(/transcript cleared/i)
    expect(VOICE_ENDED_MESSAGE).toMatch(/nothing saved/i)
    const posts = setup.fetchMock.mock.calls.filter(([url, init]) => url === '/api/live-voice' && (init as RequestInit)?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(setup.fetchMock.mock.calls.some(([url, init]) => url === '/api/live-voice' && (init as RequestInit)?.method === 'DELETE')).toBe(true)
  })
})
