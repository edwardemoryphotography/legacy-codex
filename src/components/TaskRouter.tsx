'use client'

import { supabase } from '@/lib/supabase/client'
import type { ConfirmedLesson } from '@/lib/projectReview'
import { routeTokens } from '@/lib/taskRouting'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { nextMoveContextExpiresAt, nextMoveContextKey } from '@/lib/nextMove'
import { buildTaskRoute, correctTaskRoute, HANDOFF_TOOLS, readRouteLearning, ROUTE_LANES, type HandoffTool, type RouteLane, type RouteLearning, type RouteOptions, type TaskRoute, type TaskRouteContext } from '@/lib/taskRouting'
import { useMotionAllowed } from '@/hooks/useMotionAllowed'
import { useTaskVoice } from '@/hooks/useTaskVoice'
import { useOrbInteraction } from '@/components/OrbHost'

export type RoutedActionDraft = { task: string; note: string; missionId: string; contextKey: string }
export type RouteSeed = { task: string; missionId: string; sequence: number }

export default function TaskRouter({ context, accountId, seed, canSave, onPrepare }: {
  context: TaskRouteContext
  accountId: string | null
  seed: RouteSeed | null
  canSave: boolean
  onPrepare: (draft: RoutedActionDraft | null) => void
}) {
  const [task, setTask] = useState('')
  const [engaged, setEngaged] = useState(false)
  const voice = useTaskVoice(task, setTask)
  const cancelVoice = voice.cancel
  useOrbInteraction(voice.phase === 'listening' ? 'listening' : engaged || voice.active ? 'engaged' : 'ambient')
  const [options, setOptions] = useState<RouteOptions>({ currentTool: 'Codex', stayHere: false, hybrid: true, priority: 'balanced' })
  const [learning, setLearning] = useState<RouteLearning>({})
  const [savedContext, setSavedContext] = useState<{ scope: string; lessons: ConfirmedLesson[]; status: 'ready' | 'unavailable' | 'loading' } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const pendingCorrection = useRef<{ key: string; id: string } | null>(null)
  const generation = useRef(0)
  const [learningScope, setLearningScope] = useState<string | null>(null)
  const [result, setResult] = useState<{ route: TaskRoute; inputKey: string } | null>(null)
  const [correction, setCorrection] = useState<RouteLane>('execution')
  const [message, setMessage] = useState('')
  const [clock, setClock] = useState(() => new Date().toISOString())
  const field = useRef<HTMLTextAreaElement>(null)
  const motionAllowed = useMotionAllowed()
  const storageKey = accountId ? `legacy-codex-route-learning-v1:${accountId}` : null
  const missionId = context.mission?.id ?? null
  const scopeKey = JSON.stringify([accountId, missionId, context.learningRevision ?? 0, refresh])
  const scopeRef = useRef(scopeKey)
  useLayoutEffect(() => { scopeRef.current = scopeKey }, [scopeKey])
  const effectiveContext: TaskRouteContext = { ...context, lessons: savedContext?.scope === scopeKey ? savedContext.lessons : [], learningStatus: savedContext?.scope === scopeKey ? savedContext.status : 'loading' }
  const contextKey = nextMoveContextKey(effectiveContext, new Date().toISOString())
  const inputKey = JSON.stringify([task, options, contextKey, learningScope, learning])
  const active = result?.inputKey === inputKey ? result.route : null

  useEffect(() => { cancelVoice() }, [missionId, cancelVoice])

  useEffect(() => {
    cancelVoice()
    // Only bounded token weights are stored. Tasks and project context stay
    // in memory until the person explicitly saves a canonical action.
    let restored: RouteLearning = {}
    try { if (storageKey) restored = readRouteLearning(localStorage.getItem(storageKey)) } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLearning(restored)
    setLearningScope(storageKey)
    setResult(null)
    setMessage('')
  }, [storageKey, cancelVoice])

  useEffect(() => {
    const refetch = () => setRefresh(value => value + 1)
    window.addEventListener('focus', refetch)
    window.addEventListener('legacy-codex-learning-changed', refetch)
    return () => { window.removeEventListener('focus', refetch); window.removeEventListener('legacy-codex-learning-changed', refetch) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const requestGeneration = ++generation.current
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaving(false)
    setResult(null)
    setSavedContext({ scope: scopeKey, status: 'loading', lessons: [] })
    async function restore() {
      try {
        if (!accountId) throw new Error('No account')
        const { data } = await supabase.auth.getSession()
        if (!data.session || data.session.user.id !== accountId) throw new Error('Session changed')
        const response = await fetch(`/api/task-routing${missionId ? `?missionId=${encodeURIComponent(missionId)}` : ''}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' })
        const restored = await response.json()
        if (!response.ok || restored.userId !== accountId || restored.missionId !== missionId || !Array.isArray(restored.lessons)) throw new Error('Context unavailable')
        if (cancelled || generation.current !== requestGeneration || scopeRef.current !== scopeKey) return
        setLearning(readRouteLearning(JSON.stringify(restored.weights)))
        setSavedContext({ scope: scopeKey, status: 'ready', lessons: restored.lessons })
      } catch {
        if (cancelled || generation.current !== requestGeneration || scopeRef.current !== scopeKey) return
        setSavedContext({ scope: scopeKey, status: 'unavailable', lessons: [] })
      }
    }
    void restore()
    return () => { cancelled = true }
  // scopeKey contains the account, exact project, revision and refresh generation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey])

  useEffect(() => {
    if (!seed) return
    voice.cancel()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTask(seed.task)
    setResult(null)
    setMessage('Move brought into the composer. Route it when you are ready.')
    field.current?.focus()
    field.current?.scrollIntoView({ block: 'center', behavior: motionAllowed ? 'smooth' : 'auto' })
  // Motion changes must not replace a task the person is already editing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  useEffect(() => {
    const expiresAt = nextMoveContextExpiresAt(context, new Date().toISOString())
    if (expiresAt === null) return
    const timer = window.setTimeout(() => setClock(new Date().toISOString()), Math.max(0, expiresAt - Date.now()) + 20)
    return () => window.clearTimeout(timer)
  }, [context, clock])

  useEffect(() => {
    // Invalidate a prepared action whenever its task, preferences or real
    // context changes. A stale prompt must not silently become a commitment.
    onPrepare(null)
  }, [inputKey, onPrepare])

  useEffect(() => {
    if (result && result.inputKey !== inputKey) {
      // Once invalidated, an older route must not revive if text or context
      // happens to return to the earlier value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null)
      setMessage('The task or context changed. Route again before copying or saving.')
    }
  }, [inputKey, result])

  function route(chosen?: RouteLane, weights = learning) {
    voice.cancel()
    const routed = buildTaskRoute(task, effectiveContext, options, weights, chosen)
    setResult({ route: routed, inputKey: JSON.stringify([task, options, contextKey, learningScope, weights]) })
    setCorrection(routed.primary.key)
    setMessage('')
  }

  async function teach() {
    if (!active || saving) return
    const weights = correctTaskRoute(task, correction, learning)
    setLearning(weights)
    route(correction, weights)
    let localSaved = false
    try { if (storageKey && storageKey === learningScope) { localStorage.setItem(storageKey, JSON.stringify(weights)); localSaved = true } } catch { /* session fallback */ }
    if (!accountId || !missionId) {
      setMessage(localSaved ? 'Correction learned in this browser. Choose a saved project to preserve it across devices.' : 'Correction applied for this session only.')
      return
    }
    const requestScope = scopeKey
    const requestGeneration = generation.current
    const key = JSON.stringify([accountId, missionId, task, correction])
    if (pendingCorrection.current?.key !== key) pendingCorrection.current = { key, id: crypto.randomUUID() }
    const writeId = pendingCorrection.current.id
    setSaving(true)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session || data.session.user.id !== accountId) throw new Error('Session changed')
      if (scopeRef.current !== requestScope || generation.current !== requestGeneration) return
      const response = await fetch('/api/task-routing', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ tokens: routeTokens(task), lane: correction, missionId, idempotencyKey: writeId }) })
      if (!response.ok) throw new Error('Correction unavailable')
      if (scopeRef.current !== requestScope || generation.current !== requestGeneration) return
      if (pendingCorrection.current?.id === writeId) pendingCorrection.current = null
      // Reload the durable projection and lessons together; never combine it
      // with browser weights and count the same correction twice.
      setRefresh(value => value + 1)
      setMessage('Correction saved to your account. Route again with the updated learning.')
    } catch {
      if (scopeRef.current !== requestScope || generation.current !== requestGeneration) return
      setMessage(localSaved ? 'Account save could not be confirmed. Correction is browser-only; retry uses the same write ID.' : 'Account save could not be confirmed. Correction is session-only; retry uses the same write ID.')
    } finally {
      if (scopeRef.current === requestScope && generation.current === requestGeneration) setSaving(false)
    }
  }

  async function copy(prompt: string) {
    try { await navigator.clipboard.writeText(prompt); setMessage('Handoff copied. Open it in the selected tool to begin.') }
    catch { setMessage('Clipboard unavailable. Select and copy the handoff text below.') }
  }

  return <section className="task-router" id="task-router" aria-labelledby="task-router-title">
    <div className="route-intro">
      <span className="route-eyebrow">Control panel</span>
      <h2 id="task-router-title">What should we <span>route</span> next?</h2>
      <p>Bring your own task, or route the move from Strategic Delta.</p>
      <p className="route-boundary">{effectiveContext.learningStatus === 'ready' ? 'Saved lessons and account routing corrections loaded.' : effectiveContext.learningStatus === 'loading' ? 'Reading saved lessons and routing corrections…' : 'Saved learning unavailable. Routing uses local rules; the handoff names the missing context.'}</p>
      {context.missionStatus === 'ready' && context.mission && <p className="route-target">For {context.mission.title} · {context.mission.state}</p>}
    </div>
    <form onSubmit={event => { event.preventDefault(); if (task.trim()) route() }}>
      <div className="route-composer" data-engaged={engaged || voice.active ? 'true' : undefined} data-motion={motionAllowed ? 'true' : 'false'} data-voice={voice.phase} onFocusCapture={() => setEngaged(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEngaged(false) }}>
        <label className="sr-only" htmlFor="route-task">Task to route</label>
        <textarea ref={field} id="route-task" rows={4} maxLength={2000} value={task} onChange={event => { voice.cancel(); setTask(event.target.value); setMessage('') }} placeholder="Describe the real task you want to do…" onKeyDown={event => {
          if (event.key === 'Escape') voice.cancel()
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && task.trim()) { event.preventDefault(); route() }
        }} />
        <div className="route-composer-foot"><span>⌘ / Ctrl + Enter</span><div className="route-composer-actions">
          <button className="route-mic" type="button" onClick={voice.toggle} disabled={voice.phase === 'stopping'} aria-label={voice.active ? 'Stop voice input' : 'Start voice input'} aria-pressed={voice.active} aria-describedby="route-voice-status" title="Speak your task">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6" /></svg>
          </button>
          <button className="route-primary" disabled={!task.trim()} type="submit"><span aria-hidden="true">✦</span> Route task</button>
        </div></div>
      </div>
      <p id="route-voice-status" className="route-voice-status" role="status">{voice.status || 'Speak or type your task. Voice uses your browser’s speech service.'}</p>
      <div className="route-preferences">
        <div className="route-card-heading"><h3>Preferences</h3><span>Control surface</span></div>
        <div className="route-preference-grid">
          <div>
            <label htmlFor="route-tool">Current tool</label>
            <select id="route-tool" value={options.currentTool} onChange={event => setOptions({ ...options, currentTool: event.target.value as HandoffTool })}>{HANDOFF_TOOLS.map(tool => <option key={tool}>{tool}</option>)}</select>
            <fieldset className="route-priority"><legend>Priority</legend><div>{(['speed', 'balanced', 'accuracy'] as const).map(priority => <button type="button" key={priority} aria-pressed={options.priority === priority} onClick={() => setOptions({ ...options, priority })}>{priority}</button>)}</div></fieldset>
          </div>
          <div className="route-toggles">
            <label className="route-toggle"><span><strong>Stay in my current tool</strong><small>Use it for this handoff</small></span><input type="checkbox" role="switch" checked={options.stayHere} onChange={event => setOptions({ ...options, stayHere: event.target.checked })} /><span className="route-switch" aria-hidden="true" /></label>
            <label className="route-toggle"><span><strong>Hybrid routing</strong><small>Add a useful follow-up lane</small></span><input type="checkbox" role="switch" checked={options.hybrid} onChange={event => setOptions({ ...options, hybrid: event.target.checked })} /><span className="route-switch" aria-hidden="true" /></label>
          </div>
        </div>
        <p className="route-boundary">Local rules · Handoffs only. Selecting a tool does not connect it or run your task.</p>
      </div>
    </form>
    {result && !active && <p className="route-notice" role="status">The task or context changed. Route again before copying or saving.</p>}
    {active && <div className="route-results">
      <article className="route-result" aria-label="Task route">
        <div className="route-card-heading"><span className="route-badge">{active.secondary ? 'Hybrid route' : 'Single route'}</span><span>Local rules</span></div>
        <h3>{active.primary.tool}<span className="route-arrow" aria-hidden="true"> ↗</span></h3>
        <p>{active.primary.label}{active.secondary ? ` → ${active.secondary.label} · ${active.secondary.tool}` : ''}</p>
        <p className="route-boundary">{active.match === 'general' ? 'No specialist match. Clarify the deliverable first.' : active.override ? 'Your current-tool preference overrides the suggested tool.' : 'Suggested from task keywords.'} {active.learned && 'Your saved or local corrections influenced this route.'}</p>
        {[active.primary, ...(active.secondary ? [active.secondary] : [])].map((step, index) => <details key={step.key} className="route-handoff" open={index === 0}>
          <summary>{index ? 'Follow-up' : 'Prepared'} handoff · {step.tool}</summary>
          <pre tabIndex={0}>{step.prompt}</pre>
          <button type="button" className="route-secondary" onClick={() => void copy(step.prompt)}>Copy {index ? 'follow-up' : 'handoff'}</button>
        </details>)}
        {canSave && context.mission ? <button type="button" className="route-primary" onClick={() => {
          onPrepare({ task: active.task, note: active.note, missionId: context.mission!.id, contextKey: nextMoveContextKey(context, new Date().toISOString()) })
          setMessage('Handoff prepared below. Review it, then save your next action. An existing unfinished action stays in place.')
          document.getElementById('saved-action')?.scrollIntoView({ block: 'start', behavior: motionAllowed ? 'smooth' : 'auto' })
        }}>Prepare saved action</button> : <p className="route-boundary">Choose an active mission to save this as a resumable action. You can still copy the handoff.</p>}
      </article>
      <div className="route-teach">
        <div><h3>Teach the router</h3><p>Save corrections to your account when a project is selected.</p></div>
        <label htmlFor="route-correction" className="sr-only">Correct routing lane</label>
        <select id="route-correction" value={correction} onChange={event => setCorrection(event.target.value as RouteLane)}>{ROUTE_LANES.map(lane => <option key={lane.key} value={lane.key}>{lane.label}</option>)}</select>
        <button type="button" className="route-secondary" disabled={saving} onClick={() => void teach()}>Use this lane</button>
      </div>
    </div>}
    {message && <p className="route-notice" role="status" aria-label="Routing status">{message}</p>}
  </section>
}
