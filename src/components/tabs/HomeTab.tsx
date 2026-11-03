'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useMissionTerritory } from '@/hooks/useMissionTerritory'
import { useTaskVoice } from '@/hooks/useTaskVoice'
import { OrbSlot, useOrbCognition, useOrbInteraction, useOrbPresentation } from '@/components/OrbHost'
import { BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'
import { homeMissionRoster, homeRequest, QUESTION_LIMIT, PROMPT_LIMIT, promptHelpQuestion, type HomeTool } from '@/lib/homeRequest'
import type { TabId } from '@/types'
import { emptyHomeSession, type HomeSession } from '@/lib/homeSession'
import { homeTakeaway } from '@/lib/homeTakeaway'
import { deriveNextAction, type NextActionReadState } from '@/lib/nextAction'
import styles from './HomeTab.module.css'
import ReactMarkdown from 'react-markdown'
import { recentConversation } from '@/lib/homeSession'

/** The Codex Glass home (Eddie's "Codex Glass Direction" board, 2026-10-30).
 *  Every control calls something real: the tools and composer run the existing
 *  owner-gated /api/brief modes over the person's saved missions, and the mic
 *  is the existing speech-recognition input. Nothing here is timed or faked. */

// Model-authored image URLs must not initiate background requests with project data.
const answerComponents = { img: ({ alt }: { alt?: string }) => <span>{alt}</span> }

type Tool = HomeTool
const TOOL_LABEL: Record<Tool, string> = { brief: 'Daily Brief', triage: 'Triage', ask: 'Ask Codex', prompt: 'Prompt help' }
export { promptHelpQuestion }

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


function ConversationPresence({ status, busy, loadError, pending, voice, reply }: { status: string; busy: boolean; loadError: string; pending: string | null; voice: { active: boolean; phase: string }; reply: boolean }) {
  useOrbCognition({ cognition: status === 'error' || loadError ? 'failed' : busy ? 'deriving' : status === 'done' || reply ? 'settled' : 'insufficient', operation: pending, provenance: busy ? 'model' : 'insufficient_context', recording: false })
  useOrbInteraction(voice.phase === 'listening' ? 'listening' : voice.active ? 'engaged' : 'ambient')
  return null
}

export default function HomeTab({ onNavigate, session, onSessionChange, variant = 'home', projectRevision = 0, onProjectChange }: { projectRevision?: number; onProjectChange?: () => void; variant?: 'home' | 'mission'; onNavigate: (id: TabId) => void; session?: HomeSession; onSessionChange?: Dispatch<SetStateAction<HomeSession>> }) {
  const missionView = variant === 'mission'
  const { missions, loadError, actions, actionsRead } = useMissionTerritory({ refreshKey: projectRevision })
  const brief = useBriefRunner()
  const name = useOwnerName()
  const presentation = useOrbPresentation()
  const [local, setLocal] = useState(emptyHomeSession)
  const current = session ?? local
  const update = onSessionChange ?? setLocal
  const { text, tool, history } = current
  const setText = (next: SetStateAction<string>) => update(prev => ({ ...prev, text: typeof next === 'function' ? next(prev.text) : next }))
  const setTool = (next: SetStateAction<Tool | null>) => update(prev => ({ ...prev, tool: typeof next === 'function' ? next(prev.tool) : next }))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const sending = useRef<symbol | null>(null)
  const question = useRef('')
  const input = useRef<HTMLInputElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [savingReplyAction, setSavingReplyAction] = useState(false)
  const savingReplyActionRef = useRef(false)
  const [savedReplyText, setSavedReplyText] = useState<string | null>(null)
  const [savedReplyMissionId, setSavedReplyMissionId] = useState<string | null>(null)
  const [saveReplyError, setSaveReplyError] = useState<string | null>(null)
  const panel = useRef<HTMLDialogElement>(null)
  const voice = useTaskVoice(text, next => setText(next.slice(0, QUESTION_LIMIT)), QUESTION_LIMIT)

  useEffect(() => {
    if (brief.status === 'done' && brief.output) {
      update(prev => ({ ...prev, reply: { question: question.current, text: brief.output, label: brief.outputLabel, provider: brief.providerLabel } }))
    }
  }, [brief.status, brief.output, brief.outputLabel, brief.providerLabel, update])

  // Follow the visual viewport when Safari's keyboard or browser chrome moves.
  // The composer participates in layout rather than covering a scrolling page.
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    const resize = () => {
      root.style.setProperty('--codex-viewport-height', `${viewport?.height ?? window.innerHeight}px`)
      root.style.setProperty('--codex-viewport-top', `${viewport?.offsetTop ?? 0}px`)
      if (viewport && viewport.height + 80 < window.innerHeight) root.dataset.homeKeyboard = 'true'
      else delete root.dataset.homeKeyboard
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize)
      root.style.removeProperty('--codex-viewport-height')
      root.style.removeProperty('--codex-viewport-top')
      delete root.dataset.homeKeyboard
    }
  }, [])

  const busy = brief.status === 'running'


  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  const missionCount = missions?.length ?? 0
  // Continuity is read from actual persisted rows. A failed/pending action read
  // must never be presented as proof that there is no unfinished work.
  const primaryMission = missions?.find(mission => mission.state === 'primary') ?? null
  const savedAction = actionsRead === 'ok' && primaryMission && actions
    ? actions.find(action => action.mission_id === primaryMission.id && (action.status === 'TODO' || action.status === 'IN_PROGRESS')) ?? null
    : null
  const homeReadState: NextActionReadState =
    loadError || actionsRead === 'failed'
      ? 'error'
      : missions === null || actionsRead === 'pending'
        ? 'loading'
        : !primaryMission
          ? 'empty'
          : 'loaded'
  const homeNextAction = deriveNextAction({
    readState: homeReadState,
    mission: primaryMission,
    delta: null,
    savedAction: savedAction
      ? {
          id: savedAction.id,
          missionId: savedAction.mission_id,
          title: savedAction.action_title,
          status: savedAction.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO',
          resumeNote: savedAction.resume_note,
          updatedAt: savedAction.updated_at,
        }
      : null,
  })
  const noTextNeeded = (tool === 'brief' || tool === 'triage') && !text.trim()
  // Prompt help spends part of the 400 characters on its instruction.
  const limit = tool === 'prompt' ? PROMPT_LIMIT : QUESTION_LIMIT
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
    // Routine summaries concern current work. Keep parked/finished projects in
    // Mission and in explicit questions without repeatedly surfacing them in Triage.
    const scopedMissions = homeMissionRoster(noTextNeeded
      ? missions.filter(mission => ['primary', 'secondary', 'blocked'].includes(mission.state))
      : missions)
    if (noTextNeeded && scopedMissions.length === 0) {
      setSubmitNotice('No active missions to review. Open Mission to choose work to continue.')
      return
    }
    const roster = { missions: missionsToBriefContext(scopedMissions), missionIds: scopedMissions.map(m => m.id) }
    const request = homeRequest(tool, text)
    const { label, ...payload } = request
    const submitted = text
    const token = Symbol('home-request')
    sending.current = token
    question.current = text.trim()
    setSubmitNotice('')
    try {
      update(prev => ({ ...prev, history: prev.reply ? [...prev.history, prev.reply].slice(-6) : prev.history, reply: null }))
      setHistoryOpen(false)
      setFocusOpen(false)
      setResponseOpen(false)
      const succeeded = await brief.run(request.mode, { ...payload, tier: current.tier ?? 'routine', ...roster, ...(request.mode === 'question' ? { conversation: recentConversation(current), ...(primaryMission ? { conversationMissionId: primaryMission.id } : {}) } : {}) }, label)
      if (succeeded) {
        setText(current => current === submitted ? '' : current)
        setTool(current => current === tool ? null : current)
      }
    } finally { if (sending.current === token) sending.current = null }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter while an IME (Chinese, Japanese, Korean) is composing picks a candidate; it must not send.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') { event.preventDefault(); void send() }
  }

  const immersive = !missionView && ['listening', 'thinking', 'acting'].includes(presentation.state)
  const reply = current.reply
  const hasReply = Boolean(reply)
  const takeawayTitle = reply ? homeTakeaway(reply.text).slice(0, 240) : ''
  const isReplySavedAsAction = Boolean(
    reply &&
    primaryMission &&
    ((savedAction && savedAction.action_title === takeawayTitle) ||
     (actionsRead === 'pending' && savedReplyMissionId === primaryMission.id && savedReplyText === reply.text)),
  )

  async function saveReplyAsNextAction() {
    if (!reply || !primaryMission || savingReplyAction || savingReplyActionRef.current) return
    if (actionsRead !== 'ok') {
      setSaveReplyError('Wait for your saved actions to finish loading before saving a new one.')
      return
    }
    if (savedAction && savedAction.action_title === takeawayTitle) {
      // Idempotent duplicate save: never overwrite status or resume_note.
      setSavedReplyText(reply.text)
      setSavedReplyMissionId(primaryMission.id)
      return
    }
    if (savedAction && savedAction.action_title !== takeawayTitle) {
      // Never silently overwrite an existing TODO or IN_PROGRESS saved action from conversation.
      setSaveReplyError(
        `“${savedAction.action_title}” is already saved for ${primaryMission.title}. Open Mission to resume, complete, or explicitly replace that saved action.`,
      )
      return
    }
    savingReplyActionRef.current = true
    setSavingReplyAction(true)
    setSaveReplyError(null)
    try {
      await connectMissionSession()
      const note = `From ${reply.label || 'Codex conversation'}${reply.question ? ` (“${reply.question}”)` : ''}:\n\n${reply.text}`
      const fromActions = (supabase as unknown as {
        from?: (table: string) => {
          insert?: (row: Record<string, unknown>) => {
            select?: (cols: string) => { single: () => Promise<{ data: unknown; error: unknown }> }
          }
        }
      }).from?.('actions')
      if (!fromActions || typeof fromActions.insert !== 'function') throw new Error('Actions storage unavailable.')

      const insertBuilder = fromActions.insert({
        mission_id: primaryMission.id,
        action_title: takeawayTitle,
        status: 'TODO',
        is_next_action: true,
        resume_note: note,
      })
      if (typeof insertBuilder.select === 'function') {
        const { error: writeError } = await insertBuilder.select('id').single()
        if (writeError) throw writeError
      } else {
        const { error: writeError } = await (insertBuilder as unknown as Promise<{ error: unknown }>)
        if (writeError) throw writeError
      }

      setSavedReplyText(reply.text)
      setSavedReplyMissionId(primaryMission.id)
      onProjectChange?.()
    } catch {
      setSaveReplyError('Could not save this response as your next action. Your conversation is still here — retry when ready.')
    } finally {
      savingReplyActionRef.current = false
      setSavingReplyAction(false)
    }
  }

  const panelOpen = responseOpen || historyOpen || focusOpen
  const closePanel = () => { setResponseOpen(false); setHistoryOpen(false); setFocusOpen(false) }
  useEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (panelOpen && !immersive) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [panelOpen, immersive])
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
    <section
      className={`glass-home ${styles.home} ${missionView ? styles.mission : ''}`}
      data-state={presentation.state}
      data-immersive={immersive ? 'true' : undefined}
      data-reply={hasReply ? 'true' : undefined}
      data-next-action-state={homeNextAction.state}
      data-next-action-read={homeNextAction.readState}
      aria-label={missionView ? 'Project conversation' : 'Home'}
    >
      {(!missionView || busy || voice.active) && <ConversationPresence status={brief.status} busy={busy} loadError={loadError} pending={!loadError && !busy && !voice.active ? missions === null ? 'Reading saved missions' : actionsRead === 'pending' ? 'Reading saved actions' : null : null} voice={voice} reply={Boolean(current.reply)} />}
      <div className={styles.context}>
        <span>{primaryMission ? `Working on: ${primaryMission.title}` : 'Your conversation with Codex'}</span>
        <button type="button" className="glass-chip glass" onClick={() => onNavigate(missionView ? 'home' : 'mission')}>{missionView ? 'Back to Home' : 'Open project workspace'}</button>
      </div>
      <div className="glass-hero">
        {!missionView && <div className="glass-orb-wrap">
          <OrbSlot />
          <span className="glass-orb-state" aria-hidden="true">{presentation.state === 'idle' ? 'Ready when you are' : presentation.state === 'ready' ? 'Response ready' : presentation.label}</span>
        </div>}
        <div className={styles.takeaway} hidden={immersive}>
          {reply ? <>
            <p className={styles.eyebrow}>{reply.label || 'Codex response'} · Excerpt</p>
            <h2 className={styles.answer}>{homeTakeaway(reply.text)}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={`glass-chip glass ${styles.readMore}`} aria-haspopup="dialog" aria-controls="home-detail-panel" onClick={() => { setResponseOpen(true); setHistoryOpen(false); setFocusOpen(false) }}>Read full answer <span aria-hidden="true">↗</span></button>
              {primaryMission && actionsRead === 'ok' && !isReplySavedAsAction && !savedAction && (
                <button
                  type="button"
                  className={`glass-chip glass ${styles.readMore}`}
                  disabled={savingReplyAction}
                  onClick={() => void saveReplyAsNextAction()}
                >
                  {savingReplyAction ? 'Saving next action…' : missionView ? 'Save response as my next action' : 'Save as my next action'}
                </button>
              )}
            </div>
            {primaryMission && savedAction && !isReplySavedAsAction && (
              <p className={`glass-note ${styles.currentAction}`} role="status" data-next-action-precedence="saved-first">
                Current saved action ({savedAction.status === 'IN_PROGRESS' ? 'In progress' : 'Saved'}): <strong>{savedAction.action_title}</strong>.{' '}
                {!missionView && (
                  <button type="button" className="underline" onClick={() => onNavigate('mission')}>
                    Continue in Mission
                  </button>
                )}
              </p>
            )}
            {primaryMission && isReplySavedAsAction && (
              <p className="glass-note" role="status">
                Saved as your next action for <strong>{primaryMission.title}</strong>.{' '}
                {!missionView && (
                  <button type="button" className="underline" onClick={() => onNavigate('mission')}>
                    Open in Mission
                  </button>
                )}
              </p>
            )}
            {saveReplyError && (
              <div role="alert" className="space-y-2">
                <p className="glass-note">{saveReplyError}</p>
                <button type="button" className="glass-chip glass" disabled={savingReplyAction} onClick={() => void saveReplyAsNextAction()}>
                  Retry saving next action
                </button>
              </div>
            )}
          </> : <>
            <h2 className="glass-greeting">{missionView ? 'Continue our conversation' : name ? `Hi ${name}` : 'Hi'}<span>What would you like to work through?</span></h2>
            {note && <p className="glass-note glass-home-note">{note}</p>}
          </>}
        </div>
        <div className="glass-home-links" hidden={immersive}>
          <button type="button" className="glass-chip glass" aria-haspopup="dialog" aria-controls="home-detail-panel" onClick={() => { setFocusOpen(true); setHistoryOpen(false); setResponseOpen(false) }}>Missions</button>
          <button type="button" className="glass-chip glass" aria-haspopup="dialog" aria-controls="home-detail-panel" onClick={() => { setHistoryOpen(true); setFocusOpen(false); setResponseOpen(false) }}>History{history.length ? ` · ${history.length}` : ''}</button>
        </div>
      </div>
      <dialog ref={panel} id="home-detail-panel" className={styles.panel} aria-labelledby="home-panel-title" onCancel={closePanel} onClose={closePanel} onClick={event => { if (event.target === event.currentTarget) closePanel() }}>
      <header className={styles.panelHeader}>
        <div><p className={styles.eyebrow}>Legacy Codex</p><h2 id="home-panel-title">{historyOpen ? 'Session history' : focusOpen ? 'Your missions' : reply?.label || 'Full answer'}</h2></div>
        <button type="button" autoFocus className="glass-round glass" aria-label="Close details" onClick={closePanel}>✕</button>
      </header>
      <div className={`glass-results ${styles.panelBody}`} hidden={immersive} role="region" aria-label={historyOpen ? 'Session history' : focusOpen ? 'Saved missions' : 'Codex response'} tabIndex={0}>
        {historyOpen && <section className="glass-history">
          <h3>This session</h3>
          <p className="glass-note">Recent exchanges continue between Home and Mission and survive reloads in this browser tab. Project changes still use the save controls in Mission.</p>
          {history.length === 0 && !reply && <p>No earlier responses in this session.</p>}
          {[...history, ...(reply ? [reply] : [])].map((reply, index) => <article className="glass-output glass" key={index}>
            {reply.question && <p className="glass-output-question">{reply.question}</p>}
            <p className="glass-output-label">{reply.label}</p><div className="glass-output-text"><ReactMarkdown components={answerComponents}>{reply.text}</ReactMarkdown></div>
            <p className="glass-output-meta">{reply.provider} · Conversation context · no project changes made.</p>
          </article>)}
          <button type="button" className="glass-chip glass" onClick={() => onNavigate('resumption-log')}>Open Resumption Log</button>
        </section>}
        {focusOpen && <div className="glass-focus">
        {(loadError || missions === null) && <>
          <p className="glass-note" role="status">{loadError || 'Loading your missions…'}</p>
          <button type="button" className="glass-chip glass" onClick={() => onNavigate('mission')}>Open Mission</button>
        </>}
        {missions !== null && !loadError && (
          primaryMission ? (
            <section className="glass-continuity glass" aria-label="Your saved focus">
              <p className="glass-continuity-kicker">YOUR SAVED FOCUS</p>
              <h3>{primaryMission.title}</h3>
              {actionsRead === 'pending' && <p className="glass-continuity-detail" role="status">Checking your saved actions…</p>}
              {actionsRead === 'failed' && <p className="glass-continuity-detail" role="status">Saved actions could not be checked. Your work has not been changed.</p>}
              {actionsRead === 'ok' && savedAction && (
                <div className="glass-continuity-action">
                  <p className="glass-continuity-kicker">{savedAction.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'SAVED NEXT ACTION'}</p>
                  <p className="glass-continuity-title">{savedAction.action_title}</p>
                  {savedAction.resume_note && <p className="glass-continuity-detail">Return note: {savedAction.resume_note}</p>}
                </div>
              )}
              {actionsRead === 'ok' && !savedAction && <p className="glass-continuity-detail">No unfinished action is currently linked to this Primary mission.</p>}
              <button type="button" className="glass-continuity-button" onClick={() => onNavigate('mission')}>
                {savedAction ? 'Continue in Mission' : 'Open this mission'}
              </button>
            </section>
          ) : (
            <div>
              <button type="button" className="glass-chip glass" style={{ minHeight: 44 }} onClick={() => onNavigate('mission')}>
                {missionCount === 0 ? 'Start a mission' : 'Open your missions'}
              </button>
            </div>
          )
        )}
        </div>}
        {reply && !historyOpen && !focusOpen && (
          <article className="glass-output glass">
            {reply.question && <p className="glass-output-question">{reply.question}</p>}
            {reply.label && <p className="glass-output-label">{reply.label}</p>}
            <div className="glass-output-text"><ReactMarkdown components={answerComponents}>{reply.text}</ReactMarkdown></div>
            <p className="glass-output-meta">{reply.provider ? `${reply.provider} · ` : ''}Conversation context · {isReplySavedAsAction ? `saved as next action for ${primaryMission?.title}.` : 'no project changes made until you save.'}</p>
          </article>
        )}
      </div>
      <button type="button" className="glass-chip glass" onClick={() => { closePanel(); input.current?.focus() }}>Continue conversation</button>
      </dialog>

      <div className="glass-dock">
        <fieldset className={styles.modelChoice} disabled={busy || voice.active}>
          <legend>Intelligence</legend>
          <button type="button" aria-pressed={current.tier !== 'deep'} onClick={() => update(prev => ({ ...prev, tier: 'routine' }))}>Economy</button>
          <button type="button" aria-pressed={current.tier === 'deep'} onClick={() => update(prev => ({ ...prev, tier: 'deep' }))}>Deep</button>
          <span>{current.tier === 'deep' ? 'Higher-cost reasoning' : 'Lower-cost models · default'}</span>
        </fieldset>
        <p className="glass-note">Continue here or in Mission. Recent conversation stays in this browser tab.</p>
        {busy && <button type="button" className="glass-chip glass" onClick={() => { sending.current = null; brief.reset(); setSubmitNotice('Request cancelled. Your text is still here. The server may finish processing it.'); }}>Cancel request</button>}
        {brief.status === 'error' && <button type="button" className="glass-chip glass" onClick={() => void send()}>Try again</button>}
        {(sendStatus || voice.status) && (
          <div className="glass glass-output" style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 16 }}>
            <p id="home-submit-status" className="glass-note" role="status">{sendStatus}</p>
            <p id="home-voice-status" className="glass-note" role="status">{voice.status}</p>
            {brief.visitor && <button type="button" className="glass-chip glass" style={{ minHeight: 44, marginTop: 8 }} onClick={() => onNavigate('controls')}>Sign in to your existing account</button>}
          </div>
        )}
        <div className="glass-sheet glass" style={{ bottom: 'calc(100% + 8px)' }} id="glass-tools" role="menu" aria-label="Tools" data-open={sheetOpen ? 'true' : undefined} hidden={!sheetOpen}>
          <button type="button" role="menuitem" onClick={() => pick('ask')}>Ask Codex</button>
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
        {tool && <p className="glass-note">{noTextNeeded ? `${TOOL_LABEL[tool]} uses saved missions. No question is needed.` : tool === 'brief' || tool === 'triage' ? 'Your typed text will be sent to Ask Codex instead.' : tool === 'prompt' ? 'Your text will be included in Prompt help.' : 'Your text will be sent to Ask Codex.'}</p>}
        {tool && (
          <button type="button" className="glass-tool-tag" style={{ marginBottom: 8 }} aria-label={`Remove ${TOOL_LABEL[tool]}`} onClick={() => { setTool(null); setSubmitNotice(''); input.current?.focus() }}>
            <span>{TOOL_LABEL[tool]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        <form className="glass-pill glass" onSubmit={event => { event.preventDefault(); void send() }}>
          <button type="button" className="glass-round glass-plus" aria-label="Open tools" aria-expanded={sheetOpen} aria-controls="glass-tools" disabled={busy || voice.active} onClick={() => setSheetOpen(open => !open)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <input
            ref={input}
            type="text"
            value={text}
            onChange={event => { setText(event.target.value); setSubmitNotice('') }}
            onKeyDown={onKeyDown}
            placeholder={noTextNeeded ? `${TOOL_LABEL[tool!]} · or type a question` : "Ask Codex"}
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
