'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mission } from '@/types'
import type { MissionTerritory } from '@/hooks/useMissionTerritory'
import { rowToCorrection, rowToEvidence, rowToSuppliedStep } from './tabs/MissionTab'
import { supabase } from '@/lib/supabase/client'
import { latestAcceptance } from '@/lib/nextActionLedger'
import { homeDecision } from '@/lib/homeDecision'
import type { HomeContinueView } from '@/lib/homeContinue'
import { deriveNextAction, stableHash, type SavedActionSnapshot } from '@/lib/nextAction'
import type { ProjectReview } from '@/lib/projectReview'
import { reviewCandidate, selectReviewedDelta } from '@/lib/reviewedDelta'
import HomeContinue from './HomeContinue'
import styles from './HomeContinue.module.css'

interface Props {
  territory: MissionTerritory
  mission: Mission
  view: HomeContinueView
  saved: SavedActionSnapshot | null
  allowReview: boolean
  onOpen: (focusSaved: boolean) => void
  onReviewActivity: (active: boolean) => void
  onChange: () => void
}

export default function HomeStrategicDecision({ territory, mission, view, saved, allowReview, onOpen, onChange, onReviewActivity }: Props) {
  const { accountId, missions, evidence, links, events } = territory
  const [review, setReview] = useState<ProjectReview | null>(null)
  const [phase, setPhase] = useState<'idle' | 'restoring' | 'reviewing' | 'saving'>('idle')
  const [notice, setNotice] = useState('')
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const pending = useRef(false)
  const request = useRef<AbortController | null>(null)
  const finishLine = mission.finishLine
  const missionId = mission.id
  const reviewDate = events.find(event => event.mission_id === missionId && event.type === 'delta_reviewed')?.created_at
  const eligible = allowReview && Boolean(finishLine) && !mission.blocker && !mission.capacityMismatch &&
    !evidence.some(row => row.mission_id === missionId && row.status === 'conflict')

  // The ledger event is only a hint to check the cache. Only the server's
  // current, context-keyed review may be rendered. GET never runs a model.
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    async function restore() {
      setPhase('restoring')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || session.user.id !== accountId) throw new Error()
        const res = await fetch(`/api/delta-review?missionId=${encodeURIComponent(missionId)}`, {
          headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store', signal: controller.signal,
        })
        if (!res.ok) throw new Error()
        const result = await res.json()
        if (!controller.signal.aborted) setReview(result.review ?? null)
      } catch {
        if (!controller.signal.aborted) setNotice('The previous comparison could not be checked.')
      } finally {
        if (!controller.signal.aborted) setPhase('idle')
      }
    }
    if (eligible && reviewDate && Date.parse(reviewDate) >= Date.now() - 3_600_000) void restore()
    return () => controller.abort()
  }, [accountId, missionId, eligible, reviewDate])

  useEffect(() => {
    if (phase !== 'reviewing') return
    onReviewActivity(true)
    return () => onReviewActivity(false)
  }, [phase, onReviewActivity])

  useEffect(() => {
    if (!review) return
    const timeout = setTimeout(() => setReview(null), Math.max(0, Date.parse(review.reviewedAt) + 3_600_000 - Date.now()))
    return () => clearTimeout(timeout)
  }, [review])

  const decision = useMemo(() => {
    const history = [...links].reverse()
    const corrections = history.filter(row => row.type === 'delta_corrected').map(rowToCorrection).filter(value => value !== null)
    const supplied = history.filter(row => ['delta_step_supplied', 'delta_assistance_generated'].includes(row.type))
      .map(rowToSuppliedStep).filter(value => value !== null)
    const current = eligible && review?.missionId === missionId && review.finishLine === finishLine &&
      (review.decision !== 'resume' || review.resumeActionId === saved?.id && review.operation === saved.title.trim()) ? review : null
    const candidate = reviewCandidate(current)
    const delta = selectReviewedDelta(missions ?? [], evidence.map(rowToEvidence), corrections, new Date().toISOString(),
      candidate ? [...supplied, candidate] : supplied, current)
    const nextAction = deriveNextAction({ mission, delta, savedAction: saved, acceptance: latestAcceptance(links, mission) })
    return homeDecision(view, mission, saved, delta, current, corrections, nextAction.staleReason)
  }, [links, eligible, review, missionId, finishLine, saved, missions, evidence, view, mission])

  const correctionKey = decision.correction ? JSON.stringify(decision.correction) : null
  const correcting = Boolean(correctionKey && correctionKey === correctionTarget)

  async function compare() {
    if (!eligible || phase !== 'idle' || pending.current) return
    const signal = request.current?.signal
    pending.current = true
    setPhase('reviewing')
    setNotice('')
    setReview(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== accountId) throw new Error('Reopen Home to check your account.')
      const deadline = AbortSignal.timeout(110_000)
      const res = await fetch('/api/delta-review', { method: 'POST', signal: signal ? AbortSignal.any([signal, deadline]) : deadline, headers: {
        Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ missionId, finishLine }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not compare these moves.')
      if (signal?.aborted) return
      setReview(result.review ?? null)
      setNotice(result.review ? 'Comparison ready.' : 'The current mission constraints prevent a review. Reopen Mission to check what changed.')
    } catch (err) {
      if (!signal?.aborted) setNotice(err instanceof Error && err.name === 'TimeoutError'
        ? 'The comparison timed out. Your saved step is still available.'
        : err instanceof Error ? err.message : 'Could not compare these moves.')
    } finally {
      pending.current = false
      if (!signal?.aborted) setPhase('idle')
    }
  }

  async function saveCorrection() {
    if (!reason.trim() || !decision.correction || pending.current) return
    const target = decision.correction
    const signal = request.current?.signal
    pending.current = true
    setPhase('saving')
    setNotice('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== accountId || signal?.aborted) throw new Error()
      const { error } = await supabase.from('mission_events').insert({
        user_id: accountId, mission_id: target.missionId, type: 'delta_corrected',
        idempotency_key: 'home-correction:' + stableHash(JSON.stringify([target, reason.trim(), saved?.id, links[0]?.id])),
        detail: JSON.stringify({ move: target.move, candidateId: target.candidateId, reason: reason.trim() }),
      })
      if (error && error.code !== '23505') throw error
      if (!signal?.aborted) onChange()
    } catch {
      if (!signal?.aborted) setNotice('Could not confirm your correction was saved. Your reason is still here.')
    } finally {
      pending.current = false
      if (!signal?.aborted) setPhase('idle')
    }
  }

  return <HomeContinue view={decision.view} missionCount={missions?.length ?? 0} why={decision.why} onOpenMission={() => onOpen(decision.followsSaved)}>
    {eligible && <button className={styles.secondary} disabled={phase !== 'idle' || correcting} onClick={() => void compare()}>
      {phase === 'reviewing' ? 'Comparing moves…' : 'Compare moves with AI'}
    </button>}
    {decision.correction && <button className={styles.secondary} disabled={phase !== 'idle'} aria-expanded={correcting}
      onClick={() => { setCorrectionTarget(correcting ? null : correctionKey); setReason('') }}>Correct this move</button>}
    {correcting && <form onSubmit={event => { event.preventDefault(); void saveCorrection() }}>
      <label>What makes this move wrong now?
        <textarea className={styles.reason} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} />
      </label>
      <button className={styles.secondary} disabled={!reason.trim() || phase !== 'idle'}>Save correction</button>
    </form>}
    {(phase !== 'idle' || notice) && <p role="status" className={styles.quiet}>{phase === 'restoring' ? 'Checking the saved comparison…' :
      phase === 'saving' ? 'Saving your correction…' : phase === 'reviewing' ? 'Reviewing the project and comparing alternatives…' : notice}</p>}
  </HomeContinue>
}
