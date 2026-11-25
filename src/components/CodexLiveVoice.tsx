'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '@/lib/supabase/client'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { homeMissionRoster, QUESTION_LIMIT } from '@/lib/homeRequest'
import { homeTakeaway } from '@/lib/homeTakeaway'
import type { Mission } from '@/types'
import type { LiveEntry } from '@/lib/homeSession'
import { extractFinishCondition, parseVoiceAction } from '@/lib/liveVoiceAction'
import styles from './CodexLiveVoice.module.css'

export type LiveVoicePhase = 'idle' | 'connecting' | 'listening' | 'reasoning' | 'responding' | 'interrupted'
type LiveEvent = {
  type?: string
  delta?: string
  start_ms?: number
  end_ms?: number
  offset_ms?: number
  delegation?: { id?: string; target?: string }
}
export type VoiceAnswer = { question: string; text: string; provider: string; actionTitle: string | null }
export type VoiceSaveConflict = { existingTitle: string; missionTitle: string }
export type VoiceSaveResult = { ok: boolean; error?: string; conflict?: VoiceSaveConflict }
export type LiveVoiceSnapshot = {
  active: boolean
  phase: LiveVoicePhase
  muted: boolean
  label: string
  detail: string
  hasProposal: boolean
  turnCount: number
  /** True while the microphone is actually capturing (not muted). */
  micLive: boolean
  /** The live session is connected and billed per second. */
  billed: boolean
  /** Completed turns kept for recovery in this browser tab. */
  retainedTurns: number
  /** Turns actually supplied to backend reasoning from the retained set. */
  suppliedTurns: number
  /** Turns restored from a previous genuine interruption. */
  recoveredTurns: number
}
type UserFragment = { text: string; start: number; end: number }
type TranscriptEntry = {
  id: string
  question: string
  text: string
  provider: string
  actionTitle: string | null
  finishWhen: string | null
  saved?: boolean
}

const MAX_SESSION_MS = 15 * 60 * 1000
const MAX_SPOKEN_UPDATE = 1100
const MAX_USER_PARTS = 500

// Model-authored image URLs must never initiate background requests with project data.
const markdownComponents = { img: ({ alt }: { alt?: string }) => <span>{alt}</span> }

function sendLive(channel: RTCDataChannel, type: string, delegationId: string | null, content: string) {
  if (channel.readyState !== 'open') return
  channel.send(JSON.stringify({
    type,
    event_id: crypto.randomUUID(),
    delegation_id: delegationId,
    content,
  }))
}

export function liveVoiceActivityLabel(phase: LiveVoicePhase, muted: boolean): string {
  if (phase === 'connecting') return 'Connecting…'
  if (phase === 'reasoning') return 'Codex is working'
  if (phase === 'responding') return 'Codex speaking'
  if (phase === 'interrupted') return 'Connection interrupted'
  if (phase === 'listening') return muted ? 'Microphone muted' : 'Listening'
  return ''
}

/** Browser-side GPT-Live transport. Actual reasoning still uses owner-gated /api/brief. */
export default function CodexLiveVoice({
  missions,
  primaryMissionId,
  tier,
  disabled,
  canSave = false,
  transcriptOpen = false,
  onTranscriptOpenChange,
  onAnswer,
  onPhaseChange,
  onSnapshotChange,
  onSaveAnswer,
  onOpenMission,
  initialEntries = [],
  onEntriesChange,
  onControlsChange,
}: {
  missions: Mission[]
  primaryMissionId: string | null
  tier: 'routine' | 'deep'
  disabled?: boolean
  canSave?: boolean
  transcriptOpen?: boolean
  onTranscriptOpenChange?: (open: boolean) => void
  onAnswer: (answer: VoiceAnswer) => void
  onPhaseChange: (phase: LiveVoicePhase) => void
  onSnapshotChange?: (snapshot: LiveVoiceSnapshot) => void
  onSaveAnswer?: (answer: VoiceAnswer) => Promise<VoiceSaveResult>
  onOpenMission?: () => void
  /** Completed turns recovered from this account's tab-scoped conversation. */
  initialEntries?: LiveEntry[]
  /** Persist completed turns only; never raw audio. */
  onEntriesChange?: (entries: LiveEntry[]) => void
  /** Lets the shell expose Mute/End while this screen is not visible. */
  onControlsChange?: (controls: { mute: () => void; end: () => void } | null) => void
}) {
  const [phase, setPhase] = useState<LiveVoicePhase>('idle')
  const [status, setStatus] = useState('')
  const [muted, setMuted] = useState(false)
  const [inputCaption, setInputCaption] = useState('')
  const [outputCaption, setOutputCaption] = useState('')
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const [activeProposal, setActiveProposal] = useState<TranscriptEntry | null>(null)
  const [proposalOpen, setProposalOpen] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
  const [saveConflict, setSaveConflict] = useState<VoiceSaveConflict | null>(null)
  const [localTranscriptOpen, setLocalTranscriptOpen] = useState(false)
  const [recoveredTurns, setRecoveredTurns] = useState(0)
  const inputCaptionRef = useRef('')
  useEffect(() => { inputCaptionRef.current = inputCaption }, [inputCaption])
  const initialEntriesRef = useRef(initialEntries)
  const onEntriesChangeRef = useRef(onEntriesChange)
  useEffect(() => { initialEntriesRef.current = initialEntries }, [initialEntries])
  useEffect(() => { onEntriesChangeRef.current = onEntriesChange }, [onEntriesChange])

  const isTranscriptOpen = onTranscriptOpenChange ? transcriptOpen : localTranscriptOpen
  const setTranscriptVisible = useCallback((next: boolean) => {
    if (onTranscriptOpenChange) onTranscriptOpenChange(next)
    else setLocalTranscriptOpen(next)
  }, [onTranscriptOpenChange])

  const peer = useRef<RTCPeerConnection | null>(null)
  const microphone = useRef<MediaStream | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const channel = useRef<RTCDataChannel | null>(null)
  const sessionId = useRef<string | null>(null)
  const accessToken = useRef<string | null>(null)
  const sessionController = useRef<AbortController | null>(null)
  const taskController = useRef<AbortController | null>(null)
  const autoClose = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const requestVersion = useRef(0)
  const userParts = useRef<UserFragment[]>([])
  const handledThrough = useRef(0)
  const previousTurns = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)
  const proposalDialogRef = useRef<HTMLDialogElement>(null)
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null)
  const currentInputs = useRef({ missions, primaryMissionId, tier, onAnswer })

  useEffect(() => { currentInputs.current = { missions, primaryMissionId, tier, onAnswer } }, [missions, primaryMissionId, tier, onAnswer])
  useEffect(() => { onPhaseChange(phase) }, [phase, onPhaseChange])

  const active = phase !== 'idle'
  const latestProposal = entries.slice().reverse().find(entry => Boolean(entry.actionTitle)) ?? null
  const activeLabel = liveVoiceActivityLabel(phase, muted)

  useEffect(() => {
    onSnapshotChange?.({
      active,
      phase,
      muted,
      label: activeLabel,
      detail: phase === 'interrupted' ? status : '',
      hasProposal: Boolean(latestProposal && !latestProposal.saved),
      turnCount: entries.length,
      micLive: active && phase === 'listening' && !muted,
      billed: active,
      retainedTurns: entries.length,
      suppliedTurns: Math.min(10, entries.length * 2),
      recoveredTurns,
    })
  }, [active, phase, muted, activeLabel, status, latestProposal, entries.length, recoveredTurns, onSnapshotChange])

  // Preserve reading position when returning to the transcript layer.
  useEffect(() => {
    if (!isTranscriptOpen) return
    const scroller = transcriptScrollRef.current
    if (scroller && savedScrollTop.current > 0) {
      scroller.scrollTop = savedScrollTop.current
    }
  }, [isTranscriptOpen])

  // Escape returns from the transcript curtain to the orb-first experience.
  useEffect(() => {
    if (!isTranscriptOpen || proposalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTranscriptVisible(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isTranscriptOpen, proposalOpen, setTranscriptVisible])

  // Native top-layer <dialog> for the compact Action Proposal sheet.
  useEffect(() => {
    const dialog = proposalDialogRef.current
    if (!dialog) return
    if (proposalOpen && activeProposal) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [proposalOpen, activeProposal])

  const stop = useCallback((message = 'Live conversation ended.', options: { explicit?: boolean } = {}) => {
    generation.current += 1
    requestVersion.current += 1
    sessionController.current?.abort()
    sessionController.current = null
    taskController.current?.abort()
    taskController.current = null
    if (autoClose.current) clearTimeout(autoClose.current)
    if (disconnectTimer.current) clearTimeout(disconnectTimer.current)
    if (startupTimer.current) clearTimeout(startupTimer.current)
    autoClose.current = null
    disconnectTimer.current = null
    startupTimer.current = null

    const id = sessionId.current
    const token = accessToken.current
    sessionId.current = null
    accessToken.current = null
    if (id && token) {
      void fetch('/api/live-voice', {
        method: 'DELETE', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id }),
      }).catch(() => { /* browser peer is also closed */ })
    }
    channel.current?.close()
    channel.current = null
    peer.current?.close()
    peer.current = null
    microphone.current?.getTracks().forEach(track => track.stop())
    microphone.current = null
    if (audio.current) {
      audio.current.pause()
      audio.current.srcObject = null
      audio.current.remove()
    }
    audio.current = null
    setAudioBlocked(false)
    setMuted(false)
    setProposalOpen(false)
    setTranscriptVisible(false)
    if (options.explicit) {
      // Explicit termination revokes consent: clear the retained transcript.
      setEntries([])
      setRecoveredTurns(0)
      setInputCaption('')
      setOutputCaption('')
      onEntriesChangeRef.current?.([])
      setStatus(message)
    } else {
      setPhase('idle')
      setStatus(message)
    }
    if (options.explicit) setPhase('idle')
  }, [setTranscriptVisible])

  useEffect(() => {
    // Only a session that was actually open can end. Without this guard,
    // switching apps printed "Voice ended…" for a conversation never started.
    const open = () => Boolean(sessionId.current || peer.current || microphone.current || sessionController.current || taskController.current || startupTimer.current)
    const onHidden = () => { if (document.hidden && open()) stop('Voice ended when the app went to the background.') }
    const onPageHide = () => { if (open()) stop('Voice session closed.') }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      if (open()) stop()
    }
  }, [stop])

  const toggleMute = useCallback(() => {
    setMuted(current => {
      const next = !current
      microphone.current?.getAudioTracks().forEach(track => { track.enabled = !next })
      // Mute must also honour the speaking state: no playback while muted.
      if (audio.current) audio.current.muted = next
      return next
    })
  }, [])

  useEffect(() => {
    onControlsChange?.({
      mute: toggleMute,
      end: () => stop('Live voice ended. The spoken transcript was cleared; no saved records were changed.', { explicit: true }),
    })
    return () => onControlsChange?.(null)
  }, [onControlsChange, toggleMute, stop])

  function openProposalSheet(entry: TranscriptEntry) {
    setActiveProposal(entry)
    setSaveState(entry.saved ? 'saved' : 'idle')
    setSaveError('')
    setSaveConflict(null)
    setProposalOpen(true)
  }

  function closeProposalSheet() {
    setProposalOpen(false)
  }

  const persistEntries = useCallback((next: TranscriptEntry[]) => {
    onEntriesChangeRef.current?.(next.map(({ question, text, provider, actionTitle, finishWhen, saved }) =>
      ({ question, text, provider, actionTitle, finishWhen, ...(saved ? { saved: true } : {}) })))
  }, [])

  // A direct GPT-Live answer (no backend delegation) is still a completed
  // conversational turn; retain it with the delegated ones for recovery.
  const delegatedTurn = useRef(false)
  const lastRetainedOutput = useRef('')
  useEffect(() => {
    if (phase !== 'listening' || delegatedTurn.current) return
    if (!outputCaption.trim() || !inputCaption.trim()) return
    if (lastRetainedOutput.current === outputCaption) return
    lastRetainedOutput.current = outputCaption
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(), question: inputCaption.slice(-700), text: outputCaption.slice(-4_000),
      provider: 'Live voice', actionTitle: null, finishWhen: null, saved: false,
    }
    setEntries(previous => {
      const next = [...previous, entry].slice(-20)
      persistEntries(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, outputCaption, inputCaption])

  async function start() {
    if (phase !== 'idle' || disabled) return
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setStatus('This browser cannot start a live microphone session. You can still type or use dictation.')
      return
    }

    const attempt = ++generation.current
    setStatus('Checking Codex account access…')
    setMuted(false)
    setInputCaption('')
    setOutputCaption('')
    const recovered = (initialEntriesRef.current ?? []).slice(-40)
    setEntries(recovered.map((entry, index) => ({ ...entry, id: `recovered-${index}` })))
    previousTurns.current = recovered.flatMap(entry => [
      { role: 'user' as const, text: entry.question },
      { role: 'assistant' as const, text: entry.text },
    ]).slice(-10)
    setRecoveredTurns(recovered.length)
    setActiveProposal(null)
    setProposalOpen(false)
    setTranscriptVisible(false)
    savedScrollTop.current = 0
    setSaveState('idle')
    setSaveError('')
    setSaveConflict(null)
    setPhase('connecting')
    userParts.current = []
    handledThrough.current = 0
    sessionController.current = new AbortController()

    try {
      // Check this exact deployment's paid-model owner gate before opening the
      // microphone. A successful email login and a working mission read do not
      // imply the deployment's DELTA_OPERATION_ALLOWED_USER_ID matches.
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (generation.current !== attempt) return
      if (!currentSession?.access_token) throw new Error('This browser has no active account session. Your saved missions have not been changed.')
      const preflight = await fetch('/api/live-voice', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + currentSession.access_token },
        signal: sessionController.current?.signal,
        cache: 'no-store',
      })
      if (generation.current !== attempt) return
      if (!preflight.ok) {
        const body = await preflight.json().catch(() => ({})) as { error?: string }
        throw new Error(preflight.status === 403
          ? "You are signed in, but this deployment has not granted this account owner AI access. Check the deployment's DELTA_OPERATION_ALLOWED_USER_ID. Do not sign out or move your missions."
          : body.error || 'Could not verify live voice access.')
      }
      setStatus('Requesting microphone permission…')
      // A permission prompt can remain unresolved indefinitely on iOS. Stop
      // this attempt without creating a remote session or leaving the UI busy.
      const permissionTimeout = setTimeout(() => {
        if (generation.current === attempt) stop('Microphone permission timed out. Check Safari microphone access and try again.')
      }, 45_000)
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      } finally {
        clearTimeout(permissionTimeout)
      }
      if (generation.current !== attempt) { stream.getTracks().forEach(track => track.stop()); return }
      microphone.current = stream
      const connection = new RTCPeerConnection()
      peer.current = connection
      stream.getAudioTracks().forEach(track => connection.addTrack(track, stream))
      const player = document.createElement('audio')
      player.autoplay = true
      player.setAttribute('playsinline', '')
      player.style.display = 'none'
      document.body.appendChild(player)
      audio.current = player
      connection.ontrack = event => {
        player.srcObject = event.streams[0] || new MediaStream([event.track])
        void player.play().catch(() => setAudioBlocked(true))
      }
      connection.onconnectionstatechange = () => {
        if (generation.current !== attempt) return
        if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
          stop('Voice connection ended. No records were changed.')
        } else if (connection.connectionState === 'disconnected' && !disconnectTimer.current) {
          setPhase('interrupted')
          setStatus('Reconnecting live voice…')
          disconnectTimer.current = setTimeout(() => stop('Voice connection lost. Start again to reconnect.'), 5000)
        } else if (connection.connectionState === 'connected' && disconnectTimer.current) {
          clearTimeout(disconnectTimer.current)
          disconnectTimer.current = null
          setPhase('listening')
          setStatus('')
        }
      }

      const events = connection.createDataChannel('oai-events')
      channel.current = events
      events.onclose = () => {
        if (generation.current === attempt) stop('Voice event channel closed.')
      }
      events.onmessage = message => {
        if (generation.current !== attempt) return
        let event: LiveEvent
        try { event = JSON.parse(String(message.data)) as LiveEvent } catch { return }

        if (event.type === 'session.started') {
          if (startupTimer.current) clearTimeout(startupTimer.current)
          startupTimer.current = null
          setPhase('listening')
          setStatus('')
          const title = currentInputs.current.missions.find(m => m.id === currentInputs.current.primaryMissionId)?.title
          sendLive(events, 'session.thinking.append', null,
            title ? 'Current selected Primary mission: ' + title + '. Project changes require confirmation in the interface.'
              : 'No Primary mission is selected. Only actual saved project records can establish context.')
          autoClose.current = setTimeout(() => stop('15-minute voice session limit reached. Start another session if needed.'), MAX_SESSION_MS)
        } else if (event.type === 'session.input_transcript.delta' && typeof event.delta === 'string') {
          if (inputCaptionRef.current.trim() === '') delegatedTurn.current = false
          userParts.current.push({
            text: event.delta,
            start: typeof event.start_ms === 'number' ? event.start_ms : 0,
            end: typeof event.end_ms === 'number' ? event.end_ms : 0,
          })
          userParts.current = userParts.current.slice(-MAX_USER_PARTS)
          setInputCaption(previous => (previous + event.delta).slice(-700))
          if (taskController.current) {
            requestVersion.current += 1
            taskController.current.abort()
            taskController.current = null
          }
          setStatus('')
          setPhase('listening')
        } else if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
          setOutputCaption(previous => (previous + event.delta).slice(-700))
          if (!taskController.current) setPhase('responding')
        } else if (event.type === 'session.delegation.created' && event.delegation?.target === 'client' && event.delegation.id) {
          delegatedTurn.current = true
          const delegationId = event.delegation.id
          // A transcript is made of fragments, not finished turns. Wait briefly
          // for fragments near the delegation timestamp before building context.
          sendLive(events, 'session.thinking.append', delegationId, 'Checking saved Codex context.')
          void (async () => {
            await new Promise(resolve => setTimeout(resolve, 250))
            if (generation.current !== attempt) return
            const parts = userParts.current.filter(part => part.end > handledThrough.current)
            const utterance = parts.map(part => part.text).join('').trim().slice(-QUESTION_LIMIT)
            if (typeof event.offset_ms === 'number') handledThrough.current = event.offset_ms
            else handledThrough.current = Math.max(handledThrough.current, ...parts.map(part => part.end))
            if (!utterance) {
              sendLive(events, 'session.commentary.append', delegationId,
                'The transcript for that request was not available. Ask the user to repeat the question.')
              return
            }
            const version = ++requestVersion.current
            taskController.current?.abort()
            const controller = new AbortController()
            taskController.current = controller
            setPhase('reasoning')
            setStatus('')
            try {
              const current = currentInputs.current
              const scoped = homeMissionRoster(current.missions).slice(0, 40)
              const { data: { session } } = await supabase.auth.getSession()
              if (!session?.access_token) throw new Error('Sign in to your existing Codex account.')
              const response = await fetch('/api/brief', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer ' + session.access_token,
                },
                body: JSON.stringify({
                  mode: 'question',
                  question: utterance,
                  tier: current.tier,
                  missions: missionsToBriefContext(scoped),
                  missionIds: scoped.map(m => m.id),
                  conversation: previousTurns.current.slice(-10),
                  liveVoiceAction: true,
                  ...(current.primaryMissionId && scoped.some(m => m.id === current.primaryMissionId)
                    ? { conversationMissionId: current.primaryMissionId } : {}),
                }),
              })
              const result = await response.json() as { error?: string; text?: string; provider?: string; model?: string; tier?: string }
              if (generation.current !== attempt || requestVersion.current !== version || controller.signal.aborted) return
              if (!response.ok || !result.text?.trim()) throw new Error(result.error || 'Codex did not return a usable answer.')
              const names: Record<string, string> = { anthropic: 'Claude', gemini: 'Gemini', openai: 'OpenAI' }
              const provider = (result.tier === 'deep' ? 'Deep' : 'Economy') + ' · ' +
                (names[result.provider || ''] || 'Codex') + (result.model ? ' · ' + result.model : '')
              const parsed = parseVoiceAction(result.text)
              const actual: VoiceAnswer = { question: utterance, text: parsed.text, provider, actionTitle: parsed.actionTitle }
              const entry: TranscriptEntry = {
                id: `${attempt}-${version}`,
                ...actual,
                finishWhen: extractFinishCondition(parsed.text),
                saved: false,
              }
              setSaveState('idle')
              setSaveError('')
              setSaveConflict(null)
              setInputCaption('')
              setOutputCaption('')
              previousTurns.current = [...previousTurns.current, { role: 'user' as const, text: utterance },
                { role: 'assistant' as const, text: parsed.text.slice(0, 4000) }].slice(-10)
              setEntries(previous => {
                const next = [...previous, entry].slice(-20)
                persistEntries(next)
                return next
              })
              current.onAnswer(actual)
              setStatus('')
              sendLive(events, 'session.commentary.append', delegationId,
                'Legacy Codex backend returned this answer, which is not a saved action: ' +
                parsed.text.slice(0, MAX_SPOKEN_UPDATE))
              setPhase('responding')
            } catch (error) {
              if (generation.current !== attempt || requestVersion.current !== version || controller.signal.aborted) return
              const message = error instanceof Error ? error.message : 'Codex backend unavailable.'
              setStatus(message + ' Nothing was saved.')
              sendLive(events, 'session.commentary.append', delegationId,
                'The Codex backend could not complete that request. ' + message + ' No records were changed.')
              setPhase('interrupted')
            } finally {
              if (taskController.current === controller) taskController.current = null
            }
          })()
        } else if (event.type === 'session.closed') {
          stop('Voice session ended. No changes were saved automatically.')
        } else if (event.type === 'error') {
          stop('OpenAI ended the voice connection. No records were changed.')
        }
      }

      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      if (connection.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            connection.removeEventListener('icegatheringstatechange', onIce)
            reject(new Error('Microphone connection timed out.'))
          }, 12_000)
          function onIce() {
            if (connection.iceGatheringState !== 'complete') return
            clearTimeout(timeout)
            connection.removeEventListener('icegatheringstatechange', onIce)
            resolve()
          }
          connection.addEventListener('icegatheringstatechange', onIce)
          onIce()
        })
      }
      if (generation.current !== attempt) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sign in to your existing Codex account to use live voice.')
      accessToken.current = session.access_token
      setStatus('Connecting to live voice…')
      const response = await fetch('/api/live-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        signal: sessionController.current?.signal,
        body: JSON.stringify({ sdp: connection.localDescription?.sdp }),
      })
      const created = await response.json() as { id?: string; sdp?: string; error?: string }
      if (generation.current !== attempt) {
        if (created.id) {
          void fetch('/api/live-voice', {
            method: 'DELETE', keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify({ id: created.id }),
          }).catch(() => {})
        }
        return
      }
      if (!response.ok || !created.sdp || !created.id) throw new Error(created.error || 'Voice session did not start.')
      sessionId.current = created.id
      // A successful SDP exchange is not a listening session. Bound the wait
      // for the authoritative session.started event, including data-channel
      // establishment on iOS. Abort and hang up on timeout.
      startupTimer.current = setTimeout(() => {
        if (generation.current === attempt) stop('Live voice did not reach Listening. The connection timed out; no records were changed.')
      }, 15_000)
      await connection.setRemoteDescription({ type: 'answer', sdp: created.sdp })
      // session.started is the authoritative signal that the channel is ready.
    } catch (error) {
      if (generation.current !== attempt) return
      const message = error instanceof Error ? error.message : 'Live voice could not start.'
      stop('Could not start live voice: ' + message)
    }
  }

  // Swipe up on the transcript handle / header returns smoothly to the orb
  // without interfering with vertical scrolling or text selection inside the body.
  const handleSwipeStart = (x: number, y: number) => {
    swipeOrigin.current = { x, y }
  }
  const handleSwipeUpEnd = (x: number, y: number) => {
    const startPoint = swipeOrigin.current
    swipeOrigin.current = null
    if (!startPoint) return
    const dx = x - startPoint.x
    const dy = y - startPoint.y
    if (dy < -36 && Math.abs(dy) > Math.abs(dx) * 1.25) {
      setTranscriptVisible(false)
    }
  }

  async function confirmProposalSave() {
    if (!activeProposal || !onSaveAnswer || saveState !== 'idle') return
    setSaveState('saving')
    setSaveError('')
    setSaveConflict(null)
    const result = await onSaveAnswer(activeProposal)
    if (result.ok) {
      setSaveState('saved')
      setEntries(previous => {
        const next = previous.map(item => item.id === activeProposal.id ? { ...item, saved: true } : item)
        persistEntries(next)
        return next
      })
      setActiveProposal(current => current ? { ...current, saved: true } : current)
    } else {
      setSaveState('idle')
      if (result.conflict) {
        setSaveConflict(result.conflict)
        setSaveError('')
      } else {
        setSaveError(result.error || 'Could not save this action.')
      }
    }
  }

  const hasLiveCaption = Boolean(inputCaption.trim() || outputCaption.trim())

  return (
    <section className={styles.root} data-active={active ? 'true' : undefined} aria-label="Legacy Codex live voice">
      {!active ? (
        <button
          type="button"
          className={styles.start}
          disabled={disabled}
          title="Live audio is billed per connected second. No project write happens without confirmation."
          onClick={() => void start()}
        >
          <span aria-hidden="true">◉</span> Talk live with Codex
        </button>
      ) : (
        <div className={styles.controls}>
          {phase === 'interrupted' && status && (
            <p className={styles.interruptedNote} role="status">{status}</p>
          )}

          {latestProposal && (
            <button
              type="button"
              className={styles.proposalPill}
              data-saved={latestProposal.saved ? 'true' : undefined}
              onClick={() => openProposalSheet(latestProposal)}
            >
              <span className={styles.proposalDot} aria-hidden="true" />
              <span>{latestProposal.saved ? 'Action saved · View' : 'Proposed action ready · Review'}</span>
            </button>
          )}

          {audioBlocked && (
            <button
              type="button"
              className={styles.audio}
              onClick={() => void audio.current?.play().then(() => setAudioBlocked(false)).catch(() => setStatus('Speaker playback is blocked in this browser.'))}
            >
              Enable speaker audio
            </button>
          )}

          <div className={styles.bar} role="group" aria-label="Voice session controls">
            <button
              type="button"
              className={styles.iconBtn}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              disabled={phase === 'connecting'}
              onClick={toggleMute}
            >
              {muted ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="2" y1="2" x2="22" y2="22" />
                  <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                  <path d="M5 10v2a7 7 0 0 0 12 5" />
                  <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              )}
              <span>{muted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              type="button"
              className={styles.transcriptToggle}
              aria-expanded={isTranscriptOpen}
              aria-controls="live-voice-transcript"
              onClick={() => setTranscriptVisible(!isTranscriptOpen)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16M4 12h12M4 18h8" />
              </svg>
              <span>Transcript{entries.length > 0 ? ` · ${entries.length}` : ''}</span>
            </button>

            <button
              type="button"
              className={styles.end}
              aria-label="End voice session"
              onClick={() => stop('Live voice ended. The spoken transcript was cleared; no saved records were changed.', { explicit: true })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <span>End</span>
            </button>
          </div>
        </div>
      )}

      {/* Secondary Transcript Layer: mounted while active so reading position,
          audio playback, and mic capture stay uninterrupted across transitions. */}
      {active && (
        <div
          id="live-voice-transcript"
          role="region"
          aria-label="Live voice transcript"
          aria-hidden={!isTranscriptOpen}
          className={styles.transcriptCurtain}
          data-open={isTranscriptOpen ? 'true' : undefined}
        >
          <header
            className={styles.transcriptHeader}
            onTouchStart={event => {
              const t = event.touches[0]
              if (t) handleSwipeStart(t.clientX, t.clientY)
            }}
            onTouchEnd={event => {
              const t = event.changedTouches[0]
              if (t) handleSwipeUpEnd(t.clientX, t.clientY)
            }}
            onPointerDown={event => {
              if (event.pointerType === 'touch') return
              handleSwipeStart(event.clientX, event.clientY)
            }}
            onPointerUp={event => {
              if (event.pointerType === 'touch') return
              handleSwipeUpEnd(event.clientX, event.clientY)
            }}
          >
            <div className={styles.transcriptState}>
              <span className={styles.liveDot} data-phase={phase} aria-hidden="true" />
              <span>{activeLabel}</span>
            </div>
            <button
              type="button"
              className={styles.backToOrb}
              onClick={() => setTranscriptVisible(false)}
            >
              Back to orb ↑
            </button>
          </header>

          <div
            ref={transcriptScrollRef}
            className={styles.transcriptBody}
            onScroll={event => { savedScrollTop.current = event.currentTarget.scrollTop }}
          >
            {entries.length === 0 && !hasLiveCaption ? (
              <p className={styles.emptyTranscript}>
                {phase === 'connecting'
                  ? 'Connecting your live conversation…'
                  : 'Speak naturally. Your live transcript will appear here as you talk.'}
              </p>
            ) : (
              <div className={styles.turnList}>
                {entries.map(entry => (
                  <article key={entry.id} className={styles.turnGroup}>
                    <div className={styles.userBubble}>
                      <span className={styles.speakerLabel}>You</span>
                      <p>{entry.question}</p>
                    </div>
                    <div className={styles.codexTurn}>
                      <span className={styles.speakerLabelCodex}>Codex</span>
                      <div className={styles.markdown}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {entry.text}
                        </ReactMarkdown>
                      </div>
                      <div className={styles.turnFooter}>
                        <span className={styles.turnProvider}>{entry.provider}</span>
                        {entry.actionTitle && (
                          <button
                            type="button"
                            className={styles.inlineProposalBtn}
                            onClick={() => openProposalSheet(entry)}
                          >
                            {entry.saved ? 'Action saved · View' : 'Review proposed action'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}

                {inputCaption.trim() && (
                  <div className={styles.liveCaption} data-role="user">
                    <span className={styles.speakerLabel}>You</span>
                    <p>{inputCaption}</p>
                  </div>
                )}
                {outputCaption.trim() && (
                  <div className={styles.liveCaption} data-role="codex">
                    <span className={styles.speakerLabelCodex}>Codex</span>
                    <p>{outputCaption}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className={styles.swipeHandleZone}
            onTouchStart={event => {
              const t = event.touches[0]
              if (t) handleSwipeStart(t.clientX, t.clientY)
            }}
            onTouchEnd={event => {
              const t = event.changedTouches[0]
              if (t) handleSwipeUpEnd(t.clientX, t.clientY)
            }}
            onPointerDown={event => {
              if (event.pointerType === 'touch') return
              handleSwipeStart(event.clientX, event.clientY)
            }}
            onPointerUp={event => {
              if (event.pointerType === 'touch') return
              handleSwipeUpEnd(event.clientX, event.clientY)
            }}
          >
            <span className={styles.swipePill} aria-hidden="true" />
            <span className={styles.swipeHint}>Swipe up for orb</span>
          </div>
        </div>
      )}

      {/* Compact Action Proposal Sheet: top-layer dialog, never covers orb or transcript by default. */}
      <dialog
        ref={proposalDialogRef}
        className={styles.proposalDialog}
        aria-labelledby="voice-proposal-title"
        onCancel={closeProposalSheet}
        onClose={closeProposalSheet}
        onClick={event => { if (event.target === event.currentTarget) closeProposalSheet() }}
      >
        {activeProposal && (
          <div className={styles.proposalSheet}>
            <header className={styles.proposalHeader}>
              <span className={styles.proposalStatus} data-saved={saveState === 'saved' || activeProposal.saved ? 'true' : undefined}>
                {saveState === 'saved' || activeProposal.saved ? 'Saved as next action' : 'Proposed action · not saved'}
              </span>
              <button
                type="button"
                className={styles.proposalClose}
                aria-label="Close proposed action"
                onClick={closeProposalSheet}
              >
                ✕
              </button>
            </header>

            <h3 id="voice-proposal-title" className={styles.proposalActionTitle}>
              {activeProposal.actionTitle}
            </h3>

            <div className={styles.proposalField}>
              <span className={styles.proposalFieldLabel}>Why it matters</span>
              <p>{homeTakeaway(activeProposal.text)}</p>
            </div>

            {activeProposal.finishWhen && (
              <div className={styles.proposalField}>
                <span className={styles.proposalFieldLabel}>Finish when</span>
                <p>{activeProposal.finishWhen}</p>
              </div>
            )}

            {saveConflict && (
              <div className={styles.conflictBox} role="alert">
                <p className={styles.conflictLead}>
                  You already have a saved next step for this mission. Nothing was overwritten.
                </p>
                <p className={styles.conflictHint}>
                  Open Mission to resume, complete, or explicitly replace it.
                </p>
                <details className={styles.conflictDetails}>
                  <summary>Existing saved action</summary>
                  <div className={styles.conflictDetailsBody}>
                    <p><strong>Action:</strong> {saveConflict.existingTitle}</p>
                    <p><strong>Mission:</strong> {saveConflict.missionTitle}</p>
                  </div>
                </details>
                {onOpenMission && (
                  <button
                    type="button"
                    className={styles.conflictAction}
                    onClick={() => { closeProposalSheet(); onOpenMission() }}
                  >
                    Open Mission
                  </button>
                )}
              </div>
            )}

            {saveError && !saveConflict && (
              <p className={styles.saveError} role="alert">{saveError}</p>
            )}

            <div className={styles.proposalActions}>
              {onSaveAnswer && canSave ? (
                <button
                  type="button"
                  className={styles.save}
                  disabled={saveState !== 'idle' || activeProposal.saved}
                  onClick={() => void confirmProposalSave()}
                >
                  {saveState === 'saved' || activeProposal.saved
                    ? 'Saved as next action'
                    : saveState === 'saving'
                      ? 'Saving…'
                      : 'Save as my next action'}
                </button>
              ) : (
                <p className={styles.noAction}>Choose a Primary mission in Mission before saving this action.</p>
              )}
            </div>

            <details className={styles.supportingDetails}>
              <summary>Supporting details</summary>
              <div className={styles.supportingBody}>
                <p className={styles.supportingProvider}>{activeProposal.provider}</p>
                <div className={styles.markdown}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {activeProposal.text}
                  </ReactMarkdown>
                </div>
              </div>
            </details>
          </div>
        )}
      </dialog>

      {!active && status && <p className={styles.notice} role="status">{status}</p>}
      {!active && <p className={styles.cost}>Live audio is billed per connected second. No project write happens without confirmation.</p>}
    </section>
  )
}
