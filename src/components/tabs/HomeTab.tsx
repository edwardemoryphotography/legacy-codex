'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { supabase } from '@/lib/supabase/client'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useMissionTerritory } from '@/hooks/useMissionTerritory'
import { useTaskVoice } from '@/hooks/useTaskVoice'
import { OrbSlot, useOrbCognition, useOrbInteraction, useOrbPresentation } from '@/components/OrbHost'
import { BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'
import type { TabId } from '@/types'

/** The Codex Glass home (Eddie's "Codex Glass Direction" board, 2026-10-30).
 *  Every control calls something real: the chips and pill run the existing
 *  owner-gated /api/brief modes over the person's saved missions, and the mic
 *  is the existing speech-recognition input. Nothing here is timed or faked. */

type Tool = 'brief' | 'triage' | 'ask' | 'prompt'
const TOOL_LABEL: Record<Tool, string> = { brief: 'Daily Brief', triage: 'Triage', ask: 'Ask Claude', prompt: 'Prompt help' }
const CHIPS: { tool: Tool; label: string }[] = [
  { tool: 'brief', label: 'Daily Brief' },
  { tool: 'triage', label: 'Triage' },
  { tool: 'ask', label: 'Ask Claude' },
  { tool: 'prompt', label: 'Help me write a prompt' },
]
const STATE_WORD: Record<string, string> = { idle: 'Idle', listening: 'Listening', thinking: 'Thinking', ready: 'Ready', blocked: 'Blocked', completed: 'Done' }
/** /api/brief clamps a question to 400 characters. */
const QUESTION_LIMIT = 400
const PROMPT_HELP = 'Help me write a clear, specific prompt an AI can act on, for this: '

export function promptHelpQuestion(text: string) {
  return PROMPT_HELP + text.slice(0, QUESTION_LIMIT - PROMPT_HELP.length)
}

/** "Eddie" only for the owner account; everyone else is greeted plainly. */
function useOwnerName() {
  const [name, setName] = useState('')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        const res = await fetch('/api/delta-review?capabilities=1', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const body = await res.json() as { tester?: boolean }
        if (!cancelled && body.tester === false) setName('Eddie')
      } catch { /* a plain greeting is the honest fallback */ }
    })()
    return () => { cancelled = true }
  }, [])
  return name
}

export default function HomeTab({ onNavigate }: { onNavigate: (id: TabId) => void }) {
  const { missions, loadError } = useMissionTerritory()
  const brief = useBriefRunner()
  const name = useOwnerName()
  const presentation = useOrbPresentation()
  const [text, setText] = useState('')
  const [tool, setTool] = useState<Tool | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const sending = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const output = useRef<HTMLDivElement>(null)
  const voice = useTaskVoice(text, next => setText(next.slice(0, QUESTION_LIMIT)), QUESTION_LIMIT)

  useEffect(() => {
    if (brief.output && brief.status === 'done') output.current?.scrollIntoView?.({ block: 'nearest' })
  }, [brief.output, brief.status])

  const busy = brief.status === 'running'
  useOrbCognition({
    cognition: busy ? 'deriving' : brief.status === 'error' ? 'failed' : 'insufficient',
    provenance: busy ? 'model' : 'insufficient_context',
    recording: false,
  })
  useOrbInteraction(voice.phase === 'listening' ? 'listening' : voice.active ? 'engaged' : 'ambient')

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const missionCount = missions?.length ?? 0
  const noTextNeeded = tool === 'brief' || tool === 'triage'
  // Prompt help spends part of the 400 characters on its instruction.
  const limit = tool === 'prompt' ? QUESTION_LIMIT - PROMPT_HELP.length : QUESTION_LIMIT
  const over = !noTextNeeded && text.length > limit
  // Send and microphone remain separate controls. An unavailable submission
  // explains its reason beside the input instead of silently consuming Enter.
  const ready = !busy && !voice.active && !over && (noTextNeeded || text.trim() !== '')

  const pick = (next: Tool) => {
    setTool(next)
    setSheetOpen(false)
    input.current?.focus()
  }

  const send = async () => {
    if (sending.current || busy) return
    if (voice.active) return // The visible voice status and Stop control remain available.
    if (over) { setSubmitNotice(`Too long to send: shorten it to ${limit} characters (now ${text.length}).`); return }
    if (!noTextNeeded && !text.trim()) { setSubmitNotice('Type a question before sending.'); return }
    if (loadError || missions === null) { setSubmitNotice(loadError || 'Loading your missions…'); return }
    if (brief.visitor) { setSubmitNotice(BRIEF_VISITOR_COPY); return }
    if (!brief.configured) { setSubmitNotice('AI is not configured on the server yet. Your text is still here.'); return }
    if (noTextNeeded && missionCount === 0) { setSubmitNotice('Add a mission before requesting a Daily Brief or Triage. You can ask a question here without one.'); return }
    const roster = { missions: missionsToBriefContext(missions), missionIds: missions.slice(0, 40).map(m => m.id) }
    const q = text.trim()
    const submitted = text
    sending.current = true
    setSubmitNotice('')
    try {
      const succeeded = tool === 'brief' ? await brief.run('daily_brief', { mode: 'daily_brief', ...roster }, 'Daily Brief')
        : tool === 'triage' ? await brief.run('triage', { mode: 'triage', ...roster }, 'Triage')
        : tool === 'prompt' ? await brief.run('question', { mode: 'question', question: promptHelpQuestion(q), ...roster }, 'Prompt help')
        : await brief.run('question', { mode: 'question', question: q, ...roster }, 'Ask Claude')
      if (succeeded) {
        setText(current => current === submitted ? '' : current)
        setTool(current => current === tool ? null : current)
      }
    } finally { sending.current = false }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter while an IME (Chinese, Japanese, Korean) is composing picks a candidate; it must not send.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') { event.preventDefault(); void send() }
  }

  const note = !loadError && missions !== null && missionCount === 0 ? 'Ask a question, or start a mission to save ongoing work.' : ''
  const sendStatus = submitNotice || (busy ? 'Sending…'
    : brief.visitor ? BRIEF_VISITOR_COPY
    : brief.status === 'error' ? brief.output
    : loadError ? loadError
    : missions === null ? 'Loading your missions…'
    : !brief.configured ? 'AI is not configured on the server yet.'
    : over ? `Too long to send: shorten it to ${limit} characters (now ${text.length}).`
    : !noTextNeeded && text.length === limit ? `Character limit reached (${limit}).`
    : '')

  return (
    <section className="glass-home" data-state={presentation.state} aria-label="Home">
      <div className="glass-hero" style={sendStatus || voice.status ? { paddingBottom: 'calc(260px + var(--safe-bottom, 0px))' } : undefined}>
        <div className="glass-orb-wrap">
          <OrbSlot />
          <span className="glass-orb-state" aria-hidden="true">{STATE_WORD[presentation.state] ?? 'Idle'}</span>
        </div>
        <h2 className="glass-greeting">{name ? `Hi ${name}` : 'Hi'}<span>What&apos;s the smallest next move?</span></h2>
        <div className="glass-chips">
          {CHIPS.map(chip => (
            <button key={chip.tool} type="button" className="glass-chip glass" onClick={() => pick(chip.tool)}>{chip.label}</button>
          ))}
        </div>
        <p className="glass-note" aria-live="polite">{note}</p>
        {missions !== null && !loadError && (
          <div>
            <button type="button" className="glass-chip glass" style={{ minHeight: 44 }} onClick={() => onNavigate('mission')}>
              {missionCount === 0 ? 'Start a mission' : 'Open your missions'}
            </button>
          </div>
        )}
        {brief.output && brief.status !== 'error' && (
          <div ref={output} className="glass-output glass" style={{ scrollMarginBottom: 'calc(260px + var(--safe-bottom, 0px))' }}>
            {brief.outputLabel && <p className="glass-output-label">{brief.outputLabel}</p>}
            <p className="glass-output-text">{brief.output}</p>
            {brief.providerLabel && <p className="glass-output-meta">{brief.providerLabel} · Unverified, nothing was saved.</p>}
          </div>
        )}
      </div>

      <div className="glass-dock">
        {(sendStatus || voice.status) && (
          <div className="glass glass-output" style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 16 }}>
            <p id="home-submit-status" className="glass-note" role="status">{sendStatus}</p>
            <p id="home-voice-status" className="glass-note" role="status">{voice.status}</p>
            {brief.visitor && <button type="button" className="glass-chip glass" style={{ minHeight: 44, marginTop: 8 }} onClick={() => onNavigate('controls')}>Sign in to your existing account</button>}
          </div>
        )}
        <div className="glass-sheet glass" style={{ bottom: 'calc(100% + 8px)' }} id="glass-tools" role="menu" aria-label="Tools" data-open={sheetOpen ? 'true' : undefined} hidden={!sheetOpen}>
          <button type="button" role="menuitem" onClick={() => pick('brief')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></svg>Daily Brief
          </button>
          <button type="button" role="menuitem" onClick={() => pick('triage')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>Triage
          </button>
          <button type="button" role="menuitem" onClick={() => { setSheetOpen(false); onNavigate('mission') }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>Upload a file
          </button>
          <button type="button" role="menuitem" onClick={() => pick('prompt')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" /></svg>Help me write a prompt
          </button>
        </div>
        {tool && (
          <button type="button" className="glass-tool-tag" style={{ marginBottom: 8 }} aria-label={`Remove ${TOOL_LABEL[tool]}`} onClick={() => { setTool(null); setSubmitNotice(''); input.current?.focus() }}>
            <span>{TOOL_LABEL[tool]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        <form className="glass-pill glass" onSubmit={event => { event.preventDefault(); void send() }}>
          <button type="button" className="glass-round glass-plus" aria-label="Open tools" aria-expanded={sheetOpen} aria-controls="glass-tools" onClick={() => setSheetOpen(open => !open)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input
            ref={input}
            type="text"
            value={text}
            onChange={event => { setText(event.target.value); setSubmitNotice('') }}
            onKeyDown={onKeyDown}
            placeholder="Ask Codex"
            aria-label="Ask Codex"
            aria-describedby={sendStatus || voice.status ? 'home-submit-status home-voice-status' : undefined}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={QUESTION_LIMIT}
          />
          <button type="button" className="glass-round glass-go" aria-label={voice.active ? 'Stop voice input' : 'Voice input'} aria-pressed={voice.active} onClick={voice.toggle} disabled={busy || voice.phase === 'stopping'}>
            {voice.active ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>}
          </button>
          <button type="submit" className="glass-round glass-go" data-ready={ready ? 'true' : undefined} aria-label="Send" disabled={!ready}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </button>
        </form>
      </div>
    </section>
  )
}
