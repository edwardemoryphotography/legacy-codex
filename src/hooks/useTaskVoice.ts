'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { appendVoiceTranscript, TASK_INPUT_LIMIT, voiceErrorMessage } from '@/lib/voiceInput'

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
type VoicePhase = 'idle' | 'requesting' | 'listening' | 'stopping'

/** Starts only on a human click. A browser event, never a timer, proves listening. */
export function useTaskVoice(value: string, onChange: (value: string) => void) {
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [status, setStatus] = useState('')
  const live = useRef<Recognition | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ value, onChange })
  useLayoutEffect(() => { latest.current = { value, onChange } }, [value, onChange])

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const recognition = live.current
    live.current = null
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null
      try { recognition.abort() } catch { /* already ended */ }
    }
  }, [])

  const cancel = useCallback(() => {
    if (!live.current) return
    release()
    setPhase('idle')
    setStatus('Voice input stopped.')
  }, [release])

  useEffect(() => {
    const onHidden = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', cancel)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', cancel)
      release()
    }
  }, [cancel, release])

  function toggle() {
    const current = live.current
    if (current) {
      if (phase === 'requesting') { cancel(); return }
      setPhase('stopping')
      setStatus('Finishing voice input…')
      try { current.stop() } catch { cancel() }
      // Some engines fail to send end. Never leave capture running indefinitely.
      if (live.current === current) timer.current = setTimeout(cancel, 5000)
      return
    }
    const browser = window as SpeechWindow
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition
    if (!Constructor) {
      setStatus('Voice input is not available in this browser. Use your keyboard’s microphone or type your task.')
      return
    }
    if (latest.current.value.length >= TASK_INPUT_LIMIT) {
      setStatus('Your task is at the 2,000-character limit. Shorten it before adding voice input.')
      return
    }
    try {
      const recognition = new Constructor()
      const base = latest.current.value
      let captured = false
      let limited = false
      live.current = recognition
      recognition.lang = navigator.language || document.documentElement.lang || 'en-US'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.onstart = () => {
        if (live.current !== recognition) return
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        setPhase('listening')
        setStatus('Listening… speak your task.')
      }
      recognition.onresult = event => {
        if (live.current !== recognition) return
        const transcript = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim()
        if (!transcript) return
        captured = true
        const next = appendVoiceTranscript(base, transcript)
        limited = next.length === TASK_INPUT_LIMIT
        latest.current.onChange(next)
      }
      recognition.onerror = event => {
        if (live.current !== recognition) return
        release()
        setPhase('idle')
        setStatus(voiceErrorMessage(event.error))
      }
      recognition.onend = () => {
        if (live.current !== recognition) return
        release()
        setPhase('idle')
        setStatus(limited ? 'Task reached the 2,000-character limit. Review it before routing.' : captured ? 'Voice added. Review your task, then route when ready.' : 'Voice input stopped. No words were added.')
      }
      setPhase('requesting')
      setStatus('Waiting for microphone and speech access…')
      timer.current = setTimeout(() => {
        if (live.current !== recognition) return
        release()
        setPhase('idle')
        setStatus('Voice input did not start. Check browser permissions or use keyboard dictation.')
      }, 30000)
      recognition.start()
    } catch {
      release()
      setPhase('idle')
      setStatus('Voice input could not start. Check browser permissions or use keyboard dictation.')
    }
  }

  return { phase, status, toggle, cancel, active: phase !== 'idle' }
}
