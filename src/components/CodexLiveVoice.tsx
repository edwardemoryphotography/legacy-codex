'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { homeMissionRoster, QUESTION_LIMIT } from '@/lib/homeRequest'
import type { Mission } from '@/types'
import { parseVoiceAction } from '@/lib/liveVoiceAction'
import styles from './CodexLiveVoice.module.css'

export type LiveVoicePhase = 'idle' | 'connecting' | 'listening' | 'reasoning' | 'responding'
type LiveEvent = {
  type?: string
  delta?: string
  start_ms?: number
  end_ms?: number
  offset_ms?: number
  delegation?: { id?: string; target?: string }
}
export type VoiceAnswer = { question: string; text: string; provider: string; actionTitle: string | null }
type UserFragment = { text: string; start: number; end: number }

const MAX_SESSION_MS = 15 * 60 * 1000
const MAX_SPOKEN_UPDATE = 1100
const MAX_USER_PARTS = 500

function sendLive(channel: RTCDataChannel, type: string, delegationId: string | null, content: string) {
  if (channel.readyState !== 'open') return
  channel.send(JSON.stringify({
    type,
    event_id: crypto.randomUUID(),
    delegation_id: delegationId,
    content,
  }))
}

/** Browser-side GPT-Live transport. Actual reasoning still uses owner-gated /api/brief. */
export default function CodexLiveVoice({
  missions, primaryMissionId, tier, disabled, canSave = false, onAnswer, onPhaseChange, onSaveAnswer,
}: {
  missions: Mission[]
  primaryMissionId: string | null
  tier: 'routine' | 'deep'
  disabled?: boolean
  onAnswer: (answer: VoiceAnswer) => void
  onPhaseChange: (phase: LiveVoicePhase) => void
  onSaveAnswer?: (answer: VoiceAnswer) => Promise<{ ok: boolean; error?: string }>
  canSave?: boolean
}) {
  const [phase, setPhase] = useState<LiveVoicePhase>('idle')
  const [status, setStatus] = useState('')
  const [inputCaption, setInputCaption] = useState('')
  const [outputCaption, setOutputCaption] = useState('')
  const [lastAnswer, setLastAnswer] = useState<VoiceAnswer | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
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
  const currentInputs = useRef({ missions, primaryMissionId, tier, onAnswer })
  useEffect(() => { currentInputs.current = { missions, primaryMissionId, tier, onAnswer } }, [missions, primaryMissionId, tier, onAnswer])
  useEffect(() => { onPhaseChange(phase) }, [phase, onPhaseChange])

  const stop = useCallback((message = 'Live conversation ended.') => {
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
    setPhase('idle')
    setStatus(message)
  }, [])

  useEffect(() => {
    const onHidden = () => { if (document.hidden) stop('Voice ended when the app went to the background.') }
    const onPageHide = () => stop('Voice session closed.')
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      stop()
    }
  }, [stop])

  async function start() {
    if (phase !== 'idle' || disabled) return
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setStatus('This browser cannot start a live microphone session. You can still type or use dictation.')
      return
    }

    const attempt = ++generation.current
    setStatus('Checking Codex account access…')
    setInputCaption('')
    setOutputCaption('')
    setLastAnswer(null)
    setSaveState('idle')
    setSaveError('')
    setPhase('connecting')
    userParts.current = []
    handledThrough.current = 0
    previousTurns.current = []
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
          setStatus('Reconnecting live voice…')
          disconnectTimer.current = setTimeout(() => stop('Voice connection lost. Start again to reconnect.'), 5000)
        } else if (connection.connectionState === 'connected' && disconnectTimer.current) {
          clearTimeout(disconnectTimer.current)
          disconnectTimer.current = null
          setStatus('Live voice connected.')
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
          setStatus('Listening. Interrupt or change direction whenever you want.')
          const title = currentInputs.current.missions.find(m => m.id === currentInputs.current.primaryMissionId)?.title
          sendLive(events, 'session.thinking.append', null,
            title ? 'Current selected Primary mission: ' + title + '. Project changes require confirmation in the interface.'
              : 'No Primary mission is selected. Only actual saved project records can establish context.')
          autoClose.current = setTimeout(() => stop('15-minute voice session limit reached. Start another session if needed.'), MAX_SESSION_MS)
        } else if (event.type === 'session.input_transcript.delta' && typeof event.delta === 'string') {
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
          setPhase('listening')
        } else if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
          setOutputCaption(previous => (previous + event.delta).slice(-700))
          if (!taskController.current) setPhase('responding')
        } else if (event.type === 'session.delegation.created' && event.delegation?.target === 'client' && event.delegation.id) {
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
            setStatus('Consulting real Codex missions, lessons and model routing…')
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
              setSaveState('idle')
              setSaveError('')
              previousTurns.current = [...previousTurns.current, { role: 'user' as const, text: utterance },
                { role: 'assistant' as const, text: parsed.text.slice(0, 4000) }].slice(-10)
              setLastAnswer(actual)
              current.onAnswer(actual)
              setStatus('Real Codex response received. Nothing has been saved automatically.')
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
              setPhase('listening')
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
      setStatus('Connecting to GPT-Live…')
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

  const active = phase !== 'idle'
  return (
    <section className={styles.root} data-active={active ? 'true' : undefined} aria-label="Legacy Codex live voice">
      {!active ? (
        <button type="button" className={styles.start} disabled={disabled} title="Live audio is billed per connected second. No project write happens without confirmation." aria-description="Live audio is billed per connected second. No project write happens without confirmation." onClick={() => void start()}>
          <span aria-hidden="true">◉</span> Talk live with Codex
        </button>
      ) : (
        <div className={styles.controls}>
          <p className={styles.state} role="status">
            {phase === 'connecting' ? 'Connecting' : phase === 'reasoning' ? 'Codex is working' : phase === 'responding' ? 'Codex responding' : 'Listening'}
          </p>
          {inputCaption && <p className={styles.caption} data-role="user"><span>You</span> {inputCaption}</p>}
          {outputCaption && <p className={styles.caption} data-role="codex"><span>Codex</span> {outputCaption}</p>}
          {lastAnswer && (
            <section className={styles.answer} aria-label="Codex answer and proposed action">
              <p className={styles.answerMeta}>{lastAnswer.provider} · spoken answer</p>
              <p className={styles.userTurn}><span>You</span>{lastAnswer.question}</p>
              <div className={styles.assistantTurn}><span>Codex</span><p>{lastAnswer.text}</p></div>
              {lastAnswer.actionTitle ? (
                <div className={styles.proposedAction}>
                  <p>Proposed next action</p>
                  <strong>{lastAnswer.actionTitle}</strong>
                  {onSaveAnswer && canSave ? (
                    <button type="button" className={styles.save} disabled={saveState !== 'idle'} onClick={() => {
                      setSaveState('saving')
                      setSaveError('')
                      void onSaveAnswer(lastAnswer).then(result => {
                        if (result.ok) setSaveState('saved')
                        else { setSaveState('idle'); setSaveError(result.error || 'Could not save this action.') }
                      })
                    }}>
                      {saveState === 'saved' ? 'Saved as next action' : saveState === 'saving' ? 'Saving…' : 'Save as my next action'}
                    </button>
                  ) : (
                    <p className={styles.noAction}>Choose a Primary mission in Mission before saving this action.</p>
                  )}
                  {saveError && <p className={styles.saveError} role="alert">{saveError}</p>}
                </div>
              ) : (
                <p className={styles.noAction}>No concrete action was proposed, so there is nothing to save from this answer.</p>
              )}
            </section>
          )}
          {audioBlocked && <button type="button" className={styles.audio} onClick={() => void audio.current?.play().then(() => setAudioBlocked(false)).catch(() => setStatus('Speaker playback is blocked in this browser.'))}>Enable speaker audio</button>}
          <button type="button" className={styles.end} onClick={() => stop()}>End voice session</button>
        </div>
      )}
      {status && <p className={styles.notice} role="status">{status}</p>}
      {!active && <p className={styles.cost}>Live audio is billed per connected second. No project write happens without confirmation.</p>}
    </section>
  )
}
