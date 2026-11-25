'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useHomeAccess } from '@/hooks/useHomeAccess'
import { useMissionTerritory } from '@/hooks/useMissionTerritory'
import { useTaskVoice } from '@/hooks/useTaskVoice'
import CodexLiveVoice, { type LiveVoicePhase, type VoiceAnswer } from '@/components/CodexLiveVoice'
import { OrbSlot, useOrbCognition, useOrbInteraction, useOrbPresentation } from '@/components/OrbHost'
import { BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'
import { homeMissionRoster, homeRequest, QUESTION_LIMIT, PROMPT_LIMIT, promptHelpQuestion, type HomeTool } from '@/lib/homeRequest'
import type { TabId } from '@/types'
import { emptyHomeSession, type HomeReply, type HomeSession } from '@/lib/homeSession'
import { homeTakeaway } from '@/lib/homeTakeaway'
import { deriveNextAction, type NextActionReadState } from '@/lib/nextAction'
import { latestAcceptance } from '@/lib/nextActionLedger'
import styles from './HomeTab.module.css'
import ReactMarkdown from 'react-markdown'
import { recentConversation } from '@/lib/homeSession'
import HomeStrategicDecision from '@/components/HomeStrategicDecision'
import HomeContinue from '@/components/HomeContinue'
import { activeLessonCount, deriveHomeContinue } from '@/lib/homeContinue'

/** The Codex Glass home (Eddie's "Codex Glass Direction" board, 2026-10-30).
 *  Every control calls something real: the tools and composer run the existing
 *  owner-gated /api/brief modes over the person's saved missions, and the mic
 *  is the existing speech-recognition input. Nothing here is timed or faked. */

// Model-authored image URLs must not initiate background requests with project data.
const answerComponents = { img: ({ alt }: { alt?: string }) => <span>{alt}</span> }

type Tool = HomeTool
const TOOL_LABEL: Record<Tool, string> = { brief: 'Daily Brief', triage: 'Triage', ask: 'Ask Codex', prompt: 'Prompt help' }
export { promptHelpQuestion }



function ConversationPresence({ status, busy, loadError, pending, voice, live, reply }: { status: string; busy: boolean; loadError: string; pending: string | null; voice: { active: boolean; phase: string }; live: LiveVoicePhase; reply: boolean }) {
  const consulting = busy || live === 'reasoning'
  useOrbCognition({ cognition: status === 'error' || loadError ? 'failed' : consulting ? 'deriving' : status === 'done' || reply || live === 'responding' ? 'settled' : 'insufficient', operation: live === 'reasoning' ? 'Consulting saved Codex context' : pending, provenance: consulting ? 'model' : 'insufficient_context', recording: false })
  useOrbInteraction(live === 'listening' || voice.phase === 'listening' ? 'listening' : live !== 'idle' || voice.active ? 'engaged' : 'ambient')
  return null
}

function AccessGate({ state, onSignIn, compact = false, signedIn = false, tester = false }: { state: ReturnType<typeof useHomeAccess>['state']; onSignIn: () => void; compact?: boolean; signedIn?: boolean; tester?: boolean }) {
  const gate = compact ? `${styles.accessGate} ${styles.accessCompact}` : styles.accessGate
  if (state === 'checking') {
    return <div className={gate} role="status"><p className={styles.eyebrow}>Account</p><h2>Checking account access…</h2><p>Holding the composer until this browser account is identified.</p></div>
  }
  if (state === 'unconfigured') {
    return <div className={gate} role="status"><p className={styles.eyebrow}>Account</p><h2>AI is not configured on this deployment.</h2><p>Your saved missions are still available in Mission.</p></div>
  }
  if (state === 'error') {
    return <div className={gate} role="alert"><p className={styles.eyebrow}>Account</p><h2>Could not check AI access.</h2><p>Your draft is still here. Try again, or open your saved work.</p><button type="button" className="glass-chip glass" onClick={() => window.location.reload()}>Check again</button></div>
  }
  if (tester) return <div className={gate} role="status"><h2>Project review access</h2><p>You can compare moves for your own mission within your invitation allowance. Conversation and voice require owner access.</p></div>
  if (signedIn) {
    // Already signed in: asking this person to sign in would be wrong. AI is
    // gated per deployment, so say that and leave their saved work in view.
    return (
      <div className={gate} role="status">
        <p className={styles.eyebrow}>Account</p>
        <h2>AI is not turned on for this account on this site.</h2>
        <p>You are signed in and your saved work is here. Asking Codex, voice and reviews are unavailable on this site.</p>
      </div>
    )
  }
  return (
    <div className={gate}>
      <p className={styles.eyebrow}>Account</p>
      <h2>This browser account cannot use AI yet.</h2>
      <p>{compact
        ? 'You can still name what matters and save your own missions privately. Already have an account? Sign in to it.'
        : 'Sign in to the account that owns these missions. Your saved work stays private to that account.'}</p>
      <button type="button" className={compact ? 'glass-chip glass' : `glass-chip glass ${styles.accessPrimary} home-access-primary`} onClick={onSignIn}>Sign in to your existing account</button>
    </div>
  )
}

export default function HomeTab({ onNavigate, session, onSessionChange, variant = 'home', projectRevision = 0, onProjectChange, onSignIn }: { projectRevision?: number; onProjectChange?: () => void; variant?: 'home' | 'mission'; onNavigate: (id: TabId) => void; session?: HomeSession; onSessionChange?: Dispatch<SetStateAction<HomeSession>>; onSignIn?: () => void }) {
  const missionView = variant === 'mission'
  const [reviewActive, setReviewActive] = useState(false)
  const [decisionRevision, setDecisionRevision] = useState(0)
  const territory = useMissionTerritory({ withEvents: true, withDecisionHistory: !missionView, refreshKey: projectRevision + decisionRevision })
  const { missions, loadError, actions, actionsRead, events, eventsRead, links, linksRead, linksTruncated, evidenceRead } = territory
  const brief = useBriefRunner()
  const access = useHomeAccess()
  const name = access.name
  const requestSignIn = onSignIn ?? (() => onNavigate('controls'))
  const presentation = useOrbPresentation()
  const [local, setLocal] = useState(emptyHomeSession)
  const [livePhase, setLivePhase] = useState<LiveVoicePhase>('idle')
  const liveActive = livePhase !== 'idle'
  const current = session ?? local
  const update = onSessionChange ?? setLocal
  const { text, tool, history } = current
  const setText = (next: SetStateAction<string>) => update(prev => ({ ...prev, text: typeof next === 'function' ? next(prev.text) : next }))
  const setTool = (next: SetStateAction<Tool | null>) => update(prev => ({ ...prev, tool: typeof next === 'function' ? next(prev.tool) : next }))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const [activeQuestion, setActiveQuestion] = useState('')
  const sending = useRef<symbol | null>(null)
  const question = useRef('')
  const input = useRef<HTMLTextAreaElement>(null)
  const toolSheet = useRef<HTMLDialogElement>(null)
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (seekTimer.current) clearTimeout(seekTimer.current) }, [])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [savingReplyAction, setSavingReplyAction] = useState(false)
  const savingReplyActionRef = useRef(false)
  const [savedReplyText, setSavedReplyText] = useState<string | null>(null)
  const [savedReplyMissionId, setSavedReplyMissionId] = useState<string | null>(null)
  const [saveReplyError, setSaveReplyError] = useState<string | null>(null)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const panel = useRef<HTMLDialogElement>(null)
  const voice = useTaskVoice(text, next => setText(next.slice(0, QUESTION_LIMIT)), QUESTION_LIMIT)

  useEffect(() => {
    if (brief.status === 'done' && brief.output) {
      update(prev => ({ ...prev, reply: { question: question.current, text: brief.output, label: brief.outputLabel, provider: brief.providerLabel } }))
    }
  }, [brief.status, brief.output, brief.outputLabel, brief.providerLabel, update])

  // iOS can shrink BOTH innerHeight and visualViewport when its keyboard opens.
  // Comparing only those two misses the keyboard; bulky voice controls can
  // then push the focused textarea out of the constrained Home shell.
  // Compact on focus and follow visualViewport scroll as well as resize.
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    const field = input.current
    let unfocusedHeight = Math.max(window.innerHeight, viewport?.height ?? 0)
    if (!missionView) root.dataset.homeViewport = 'true'
    const resize = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight
      const composing = document.activeElement === field
      if (!composing) unfocusedHeight = Math.max(window.innerHeight, visibleHeight)
      const keyboardOpen = composing &&
        (unfocusedHeight - visibleHeight > 80 || window.innerHeight - visibleHeight > 80)
      root.style.setProperty('--codex-viewport-height', String(visibleHeight) + 'px')
      // WKWebView can apply visualViewport.offsetTop to the fixed app shell
      // *again* after WebKit has scrolled the focused field into view. Keep the
      // shell at the layout origin; position the focused dock independently.
      root.style.setProperty('--codex-viewport-top', '0px')
      const visibleBottom = visibleHeight + (viewport?.offsetTop ?? 0)
      const keyboardInset = composing ? Math.max(0, window.innerHeight - visibleBottom) : 0
      root.style.setProperty('--codex-composer-bottom', String(keyboardInset) + 'px')
      if (composing) root.dataset.homeComposing = 'true'
      else delete root.dataset.homeComposing
      if (keyboardOpen) root.dataset.homeKeyboard = 'true'
      else delete root.dataset.homeKeyboard
    }
    resize()
    field?.addEventListener('focus', resize)
    field?.addEventListener('blur', resize)
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    return () => {
      field?.removeEventListener('focus', resize)
      field?.removeEventListener('blur', resize)
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      root.style.removeProperty('--codex-viewport-height')
      root.style.removeProperty('--codex-viewport-top')
      root.style.removeProperty('--codex-composer-bottom')
      delete root.dataset.homeViewport
      delete root.dataset.homeComposing
      delete root.dataset.homeKeyboard
    }
  }, [missionView])

  useEffect(() => {
    const field = input.current
    if (!field) return
    field.style.height = 'auto'
    const next = Math.max(28, Math.min(field.scrollHeight || 28, 120))
    field.style.height = `${next}px`
    setComposerExpanded(next > 34 || text.includes('\n'))
  }, [text])

  const busy = brief.status === 'running'


  // Native modal dialogs are promoted to the browser's top layer, outside the
  // fixed Home shell and all of its overflow/transform clipping ancestors.
  useEffect(() => {
    const dialog = toolSheet.current
    if (!dialog) return
    if (sheetOpen && !dialog.open) dialog.showModal()
    else if (!sheetOpen && dialog.open) dialog.close()
  }, [sheetOpen])

  const missionCount = missions?.length ?? 0
  // Continuity is read from actual persisted rows. A failed/pending action read
  // must never be presented as proof that there is no unfinished work.
  const primaryMission = missions?.find(mission => mission.state === 'primary') ?? null
  const savedAction = actionsRead === 'ok' && primaryMission && actions
    ? actions.find(action => action.mission_id === primaryMission.id && (action.status === 'TODO' || action.status === 'IN_PROGRESS')) ?? null
    : null
  const acceptanceRows = !missionView && linksRead === 'ok' && !linksTruncated ? links : events
  const acceptance = primaryMission && eventsRead === 'ok' ? latestAcceptance(acceptanceRows, primaryMission) : null
  const homeReadState: NextActionReadState =
    loadError || actionsRead === 'failed' || eventsRead === 'failed'
      ? 'error'
      : missions === null || actionsRead === 'pending' || eventsRead === 'pending'
        ? 'loading'
        : !primaryMission
          ? 'empty'
          : 'loaded'
  const homeNextActionSaved = savedAction
    ? {
        id: savedAction.id,
        missionId: savedAction.mission_id,
        title: savedAction.action_title,
        status: savedAction.status === 'IN_PROGRESS' ? 'IN_PROGRESS' as const : 'TODO' as const,
        resumeNote: savedAction.resume_note,
        updatedAt: savedAction.updated_at,
      }
    : null
  const homeNextAction = deriveNextAction({
    readState: homeReadState,
    mission: primaryMission,
    delta: null,
    acceptance,
    savedAction: homeNextActionSaved,
  })
  // Home's first answer, before anything is typed. Corrections belong to the
  // mission they were made on. Lessons are counted across the account only: a
  // lesson row's mission is where it is filed, never its historical source.
  const linksKnown = linksRead === 'ok' && !linksTruncated && Array.isArray(links)
  // The card needs the mission and its actions. The event history only adds an
  // accepted suggestion, which a saved step outranks, so a failed or pending
  // history read must not hide a mission and saved step that did load.
  const coreReadState: NextActionReadState =
    loadError || actionsRead === 'failed' ? 'error'
      : missions === null || actionsRead === 'pending' ? 'loading'
        : !primaryMission ? 'empty'
          : !savedAction && eventsRead === 'pending' ? 'loading'
            : 'loaded'
  const continueView = deriveHomeContinue({
    readState: coreReadState,
    missionCount: missions?.length ?? 0,
    mission: primaryMission,
    nextAction: coreReadState === 'loaded' && homeNextAction.readState !== 'loaded'
      ? deriveNextAction({ readState: 'loaded', mission: primaryMission, delta: null, acceptance: null, savedAction: homeNextActionSaved })
      : homeNextAction,
    acceptanceKnown: eventsRead !== 'failed',
    resumeNote: savedAction?.resume_note,
    correctionCount: linksKnown && primaryMission ? links.filter(row => row.type === 'delta_corrected' && row.mission_id === primaryMission.id).length : null,
    activeLessonCount: linksKnown ? activeLessonCount(links) : null,
  })
  // The card's button goes to the saved step itself, not just the top of
  // Mission, where the step can be a screen or more down. The saved-action
  // card loads after navigation, so look for it briefly and then stop.
  const openMission = (focusSaved = true) => {
    onNavigate('mission')
    const id = savedAction?.id
    if (!id || !focusSaved) return
    if (seekTimer.current) clearTimeout(seekTimer.current)
    let tries = 0
    const seek = () => {
      const target = document.getElementById(`saved-action-${id}`)
      if (target) {
        target.scrollIntoView({ block: 'start' })
        target.focus({ preventScroll: true })
        return
      }
      tries += 1
      if (tries < 40) seekTimer.current = setTimeout(seek, 150)
    }
    seekTimer.current = setTimeout(seek, 0)
  }
  const completeDecision = !missionView && primaryMission && territory.accountId && homeReadState === 'loaded' &&
    evidenceRead === 'ok' && linksKnown
  const homeCard = completeDecision ? <HomeStrategicDecision
    key={`${territory.accountId}:${primaryMission.id}:${projectRevision}:${decisionRevision}`}
    territory={territory} mission={primaryMission} saved={homeNextActionSaved} view={continueView}
    allowReview={access.configured && (access.state === 'owner' || access.tester === true)}
    tier={current.tier === 'deep' ? 'deep' : 'routine'}
    onOpen={openMission} onReviewActivity={setReviewActive} onChange={() => setDecisionRevision(value => value + 1)}
  /> : <HomeContinue view={continueView} name={access.state === 'owner' ? name : undefined} missionCount={missionCount} onOpenMission={() => openMission()}>
    {primaryMission && (evidenceRead === 'failed' || linksRead === 'failed' || linksTruncated || eventsRead === 'failed') &&
      <p role="status">Showing saved context. Codex could not check the full decision history and evidence.</p>}
  </HomeContinue>
  const noTextNeeded = (tool === 'brief' || tool === 'triage') && !text.trim()
  // Prompt help spends part of the question limit on its instruction.
  const limit = tool === 'prompt' ? PROMPT_LIMIT : QUESTION_LIMIT
  const over = !noTextNeeded && text.length > limit
  // Send and microphone remain separate controls. An unavailable submission
  // explains its reason beside the input instead of silently consuming Enter.
  const ready = access.state === 'owner' && access.configured && !reviewActive && !busy && !voice.active && !over && (noTextNeeded || text.trim() !== '')

  const closeTools = () => {
    setSheetOpen(false)
    if (toolSheet.current?.open) toolSheet.current.close()
  }

  const pick = (next: Tool) => {
    setTool(next)
    // Close the native modal before focusing its inert background textarea.
    closeTools()
    input.current?.focus()
  }

  const send = async () => {
    if (sending.current || busy) return
    // One model request at a time: Enter must honour the same exclusion as the
    // disabled Send control while a move comparison is running.
    if (reviewActive) return
    if (access.state !== 'owner') {
      setSubmitNotice(access.state === 'checking'
        ? 'Checking whether this account can use AI. Your text is still here.'
        : 'AI is not enabled for this browser account. Sign in to your existing account. Your text is still here.')
      return
    }
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
    const trimmedQuestion = text.trim()
    question.current = trimmedQuestion
    setActiveQuestion(trimmedQuestion)
    setSubmitNotice('')
    try {
      update(prev => ({ ...prev, history: prev.reply ? [...prev.history, prev.reply].slice(-6) : prev.history, reply: null }))
      setHistoryOpen(false)
      setResponseOpen(false)
      const succeeded = await brief.run(request.mode, { ...payload, tier: current.tier ?? 'routine', ...roster, ...(request.mode === 'question' ? { conversation: recentConversation(current), ...(primaryMission ? { conversationMissionId: primaryMission.id } : {}) } : {}) }, label)
      if (succeeded) {
        setText(current => current === submitted ? '' : current)
        if (text === submitted) setComposerExpanded(false)
        setTool(current => current === tool ? null : current)
      }
    } finally { if (sending.current === token) sending.current = null }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an IME (Chinese, Japanese, Korean) is composing picks a candidate; it must not send.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() }
  }

  const immersive = !missionView && (liveActive || (!reviewActive && ['listening', 'thinking', 'acting'].includes(presentation.state)))
  const reply = current.reply
  const hasReply = Boolean(reply)
  const takeawayTitle = reply ? homeTakeaway(reply.text).slice(0, 240) : ''
  const proposedTitle = reply?.actionTitle?.trim() || takeawayTitle
  const isReplySavedAsAction = Boolean(
    reply &&
    primaryMission &&
    ((savedAction && savedAction.action_title === proposedTitle) ||
     (actionsRead === 'pending' && savedReplyMissionId === primaryMission.id && savedReplyText === reply.text)),
  )

  async function saveReplyAsNextAction(candidate: HomeReply | null = reply, titleOverride?: string): Promise<{ ok: boolean; error?: string }> {
    if (!candidate || !primaryMission || savingReplyAction || savingReplyActionRef.current) {
      return { ok: false, error: 'Open a Primary mission before saving an action.' }
    }
    const title = (titleOverride?.trim() || candidate.actionTitle?.trim() || homeTakeaway(candidate.text)).slice(0, 240)
    if (actionsRead !== 'ok') {
      const message = 'Wait for your saved actions to finish loading before saving a new one.'
      setSaveReplyError(message)
      return { ok: false, error: message }
    }
    if (savedAction && savedAction.action_title === title) {
      // Idempotent duplicate save: never overwrite status or resume_note.
      setSavedReplyText(candidate.text)
      setSavedReplyMissionId(primaryMission.id)
      return { ok: true }
    }
    if (savedAction && savedAction.action_title !== title) {
      // Never silently overwrite an existing TODO or IN_PROGRESS saved action from conversation.
      const message = `“${savedAction.action_title}” is already saved for ${primaryMission.title}. Open Mission to resume, complete, or explicitly replace that saved action.`
      setSaveReplyError(message)
      return { ok: false, error: message }
    }
    savingReplyActionRef.current = true
    setSavingReplyAction(true)
    setSaveReplyError(null)
    try {
      await connectMissionSession()
      const note = `From ${candidate.label || 'Codex conversation'}${candidate.question ? ` (“${candidate.question}”)` : ''}:\n\n${candidate.text}`
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
        action_title: title,
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

      setSavedReplyText(candidate.text)
      setSavedReplyMissionId(primaryMission.id)
      onProjectChange?.()
      return { ok: true }
    } catch {
      const message = 'Could not save this response as your next action. Your conversation is still here — retry when ready.'
      setSaveReplyError(message)
      return { ok: false, error: message }
    } finally {
      savingReplyActionRef.current = false
      setSavingReplyAction(false)
    }
  }

  async function saveLiveAnswer(answer: VoiceAnswer) {
    return saveReplyAsNextAction({
      question: answer.question,
      text: answer.text,
      label: 'Live Codex',
      provider: answer.provider,
      actionTitle: answer.actionTitle,
    })
  }

  const panelOpen = responseOpen || historyOpen
  const closePanel = () => { setResponseOpen(false); setHistoryOpen(false) }
  useEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (panelOpen && !immersive) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) dialog.close()
  }, [panelOpen, immersive])
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
      data-live-voice-active={liveActive ? 'true' : undefined}
      data-immersive={immersive ? 'true' : undefined}
      data-reviewing={reviewActive ? 'true' : undefined}
      data-reply={hasReply ? 'true' : undefined}
      data-access-gate={access.state !== 'owner' ? 'true' : undefined}
      data-composer-expanded={composerExpanded ? 'true' : undefined}
      data-continue={!missionView && !hasReply ? continueView.status : undefined}
      data-next-action-state={homeNextAction.state}
      data-next-action-read={homeNextAction.readState}
      aria-label={missionView ? 'Project conversation' : 'Home'}
    >
      {access.state === 'owner' && (!missionView || busy || voice.active || liveActive) && <ConversationPresence status={brief.status} busy={busy || reviewActive} loadError={loadError} pending={reviewActive ? (current.tier === 'deep' ? 'Deep review · draft & critique' : 'Economy · single structured pass') : !loadError && !busy && !voice.active && !liveActive ? missions === null ? 'Reading saved missions' : actionsRead === 'pending' ? 'Reading saved actions' : null : null} voice={voice} live={livePhase} reply={Boolean(current.reply)} />}
      <div className={styles.context}>
        {(missionView || hasReply) && <span>{primaryMission ? `Working on: ${primaryMission.title}` : 'Your conversation with Codex'}</span>}
        {/* The card's own button opens Mission, so a second control to the same
            place appears only when the card is not offering one. */}
        {(missionView || hasReply || continueView.status === 'loading') && <button type="button" className="glass-chip glass" onClick={() => onNavigate(missionView ? 'home' : 'mission')}>{missionView ? 'Back to Home' : 'Open Mission'}</button>}
        <button type="button" className={`glass-chip glass ${styles.historyBtn}`} hidden={immersive || reviewActive || (access.state !== 'owner' && history.length === 0 && !hasReply)} aria-haspopup="dialog" aria-controls="home-detail-panel" onClick={() => { setHistoryOpen(true); setResponseOpen(false) }}>History{history.length ? ` · ${history.length}` : ''}</button>
      </div>
      <div className="glass-hero">
        {access.state !== 'owner' ? (missionView ? <AccessGate state={access.state} onSignIn={requestSignIn} tester={access.tester} /> : <>
          {homeCard}
          <AccessGate state={access.state} onSignIn={requestSignIn} compact signedIn={access.signedIn} tester={access.tester} />
        </>) : <>
        {!missionView && <div className="glass-orb-wrap">
          <OrbSlot />
          <span className="glass-orb-state" aria-hidden="true">{presentation.state === 'idle' ? 'Ready when you are' : presentation.state === 'ready' ? 'Recommendation ready' : presentation.label}</span>
          {immersive && busy && (
            <p className={styles.activeObjective}>
              {activeQuestion ? `“${activeQuestion.length > 96 ? `${activeQuestion.slice(0, 93)}…` : activeQuestion}”` : tool ? TOOL_LABEL[tool] : 'Working on your request'}
            </p>
          )}
        </div>}
        <div className={styles.takeaway} hidden={immersive}>
          {reply ? <>
            <p className={styles.eyebrow}>{reply.label || 'Codex response'} · Excerpt</p>
            <h2 className={styles.answer}>{homeTakeaway(reply.text)}</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {!missionView && <button type="button" className="glass-chip glass" onClick={() => update(previous => ({
                ...previous, history: previous.reply ? [...previous.history, previous.reply].slice(-6) : previous.history, reply: null,
              }))}>Back to my next move</button>}
              <button type="button" className={`glass-chip glass ${styles.readMore}`} aria-haspopup="dialog" aria-controls="home-detail-panel" onClick={() => { setResponseOpen(true); setHistoryOpen(false) }}>Read full answer <span aria-hidden="true">↗</span></button>
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
            {primaryMission && !savedAction && homeNextAction.state === 'accepted' && (
              <p className={`glass-note ${styles.currentAction}`} role="status" data-next-action-precedence="accepted">
                Accepted move: <strong>{homeNextAction.title}</strong>.{' '}
                {!missionView && (
                  <button type="button" className="underline" onClick={() => onNavigate('mission')}>
                    Open Mission
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
          </> : missionView ? (
            <h2 className="glass-greeting">Continue our conversation<span>What would you like to work through?</span></h2>
          ) : (
            homeCard
          )}
        </div>
      </>}
      </div>
      <dialog ref={panel} id="home-detail-panel" className={styles.panel} aria-labelledby="home-panel-title" onCancel={closePanel} onClose={closePanel} onClick={event => { if (event.target === event.currentTarget) closePanel() }}>
      <header className={styles.panelHeader}>
        <div><p className={styles.eyebrow}>Legacy Codex</p><h2 id="home-panel-title">{historyOpen ? 'Session history' : reply?.label || 'Full answer'}</h2></div>
        <button type="button" autoFocus className="glass-round glass" aria-label="Close details" onClick={closePanel}>✕</button>
      </header>
      <div className={`glass-results ${styles.panelBody}`} hidden={immersive} role="region" aria-label={historyOpen ? 'Session history' : 'Codex response'} tabIndex={0}>
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
        {reply && !historyOpen && (
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

      <div className="glass-dock" hidden={access.state !== 'owner'}>
        <div className={styles.dockBar}>
          <fieldset className={styles.modelChoice} disabled={busy || voice.active || reviewActive}>
            <legend>Intelligence</legend>
            <button type="button" aria-pressed={current.tier !== 'deep'} onClick={() => update(prev => ({ ...prev, tier: 'routine' }))}>Economy</button>
            <button type="button" aria-pressed={current.tier === 'deep'} onClick={() => update(prev => ({ ...prev, tier: 'deep' }))}>Deep</button>
          </fieldset>
          <CodexLiveVoice
            missions={missions ?? []}
            primaryMissionId={primaryMission?.id ?? null}
            tier={current.tier === 'deep' ? 'deep' : 'routine'}
            disabled={reviewActive || busy || voice.active || missions === null || Boolean(loadError) || !brief.configured || access.state !== 'owner'}
            onPhaseChange={setLivePhase}
            onSaveAnswer={saveLiveAnswer}
            canSave={Boolean(primaryMission)}
            onAnswer={answer => {
              update(previous => ({
                ...previous,
                history: previous.reply ? [...previous.history, previous.reply].slice(-6) : previous.history,
                reply: { question: answer.question, text: answer.text, label: 'Live Codex', provider: answer.provider, actionTitle: answer.actionTitle },
              }))
              setSavedReplyText(null)
              setSavedReplyMissionId(null)
              setSaveReplyError(null)
            }}
          />
        </div>
        <p className="glass-note home-runtime-note">Continue here or in Mission. Recent conversation stays in this browser tab.</p>
        {busy && <button type="button" className="glass-chip glass" onClick={() => { sending.current = null; brief.reset(); setSubmitNotice('Request cancelled. Your text is still here. The server may finish processing it.'); }}>Cancel request</button>}
        {brief.status === 'error' && <button type="button" className="glass-chip glass" onClick={() => void send()}>Try again</button>}
        {(sendStatus || voice.status) && (
          <div className="glass glass-output" style={{ marginBottom: 8, padding: '10px 12px', borderRadius: 16 }}>
            <p id="home-submit-status" className="glass-note" role="status">{sendStatus}</p>
            <p id="home-voice-status" className="glass-note" role="status">{voice.status}</p>
            {brief.visitor && <button type="button" className="glass-chip glass" style={{ minHeight: 44, marginTop: 8 }} onClick={() => onNavigate('controls')}>Sign in to your existing account</button>}
          </div>
        )}
        <dialog
          ref={toolSheet}
          className={styles.toolsDialog}
          aria-label="Codex tools"
          onCancel={() => setSheetOpen(false)}
          onClose={() => setSheetOpen(false)}
          onClick={event => { if (event.target === event.currentTarget) closeTools() }}
        >
          <div className={styles.toolsHeader}>
            <span>Codex tools</span>
            <button type="button" aria-label="Close tools" onClick={closeTools}>✕</button>
          </div>
          <div className={styles.toolsList} id="glass-tools" role="menu" aria-label="Tools">
          <button type="button" role="menuitem" onClick={() => pick('ask')}>Ask Codex</button>
          <button type="button" role="menuitem" onClick={() => pick('brief')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></svg>Daily Brief
          </button>
          <button type="button" role="menuitem" onClick={() => pick('triage')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>Triage
          </button>
          <button type="button" role="menuitem" onClick={() => { closeTools(); onNavigate('mission') }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>Upload a file
          </button>
          <button type="button" role="menuitem" onClick={() => pick('prompt')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" /></svg>Help me write a prompt
          </button>
          </div>
        </dialog>
        {tool && <p className="glass-note">{noTextNeeded ? `${TOOL_LABEL[tool]} uses saved missions. No question is needed.` : tool === 'brief' || tool === 'triage' ? 'Your typed text will be sent to Ask Codex instead.' : tool === 'prompt' ? 'Your text will be included in Prompt help.' : 'Your text will be sent to Ask Codex.'}</p>}
        {tool && (
          <button type="button" className="glass-tool-tag" style={{ marginBottom: 8 }} aria-label={`Remove ${TOOL_LABEL[tool]}`} onClick={() => { setTool(null); setSubmitNotice(''); input.current?.focus() }}>
            <span>{TOOL_LABEL[tool]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        {access.state === 'checking' && <p className="glass-note" role="status">Checking account access…</p>}
        {access.state !== 'owner' && access.state !== 'checking' && (
          <p className="glass-note" role="status">
            {access.state === 'unconfigured'
              ? 'AI is not configured on the server. Your text is still here.'
              : 'This browser account cannot use AI. '}
            {access.state !== 'unconfigured' && (
              <button type="button" className="underline" style={{ minHeight: 44 }} onClick={requestSignIn}>
                Sign in to your existing account
              </button>
            )}
            {access.state !== 'unconfigured' && ' to use it. Your draft stays here.'}
          </p>
        )}
        <form className="glass-pill glass" onSubmit={event => { event.preventDefault(); void send() }}>
          <button type="button" className="glass-round glass-plus" aria-label="Open tools" aria-expanded={sheetOpen} aria-controls="glass-tools" disabled={busy || voice.active} onClick={() => setSheetOpen(open => !open)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={event => { const value = event.target.value; setText(value); setComposerExpanded(value.includes('\n') || value.length > 80); setSubmitNotice('') }}
            onKeyDown={onKeyDown}
            onFocus={() => setSheetOpen(false)}
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
