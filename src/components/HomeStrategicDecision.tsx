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
import { reviewProvenanceSummary, sourceKindLabel } from '@/lib/readableProvenance'
import { reviewCandidate, selectReviewedDelta } from '@/lib/reviewedDelta'
import HomeContinue from './HomeContinue'
import styles from './HomeContinue.module.css'

interface Props {
  territory: MissionTerritory
  mission: Mission
  view: HomeContinueView
  saved: SavedActionSnapshot | null
  allowReview: boolean
  tier?: 'routine' | 'deep'
  onOpen: (focusSaved: boolean) => void
  onReviewActivity: (active: boolean) => void
  onChange: () => void
}

export default function HomeStrategicDecision({ territory, mission, view, saved, allowReview, tier = 'routine', onOpen, onChange, onReviewActivity }: Props) {
  const { accountId, missions, evidence, links, events } = territory
  const [review, setReview] = useState<ProjectReview | null>(null)
  const [phase, setPhase] = useState<'idle' | 'restoring' | 'reviewing' | 'saving'>('idle')
  const [notice, setNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const pending = useRef(false)
  const request = useRef<AbortController | null>(null)
  const activeReviewAbort = useRef<AbortController | null>(null)
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
        const res = await fetch(`/api/delta-review?missionId=${encodeURIComponent(missionId)}&tier=${tier}`, {
          headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store', signal: controller.signal,
        })
        if (!res.ok) throw new Error()
        const result = await res.json()
        if (!controller.signal.aborted) setReview(result.review ?? null)
      } catch {
        if (!controller.signal.aborted) {
          setNotice('The previous comparison could not be checked.')
          setNoticeError(false)
        }
      } finally {
        if (!controller.signal.aborted) setPhase('idle')
      }
    }
    if (eligible && reviewDate && Date.parse(reviewDate) >= Date.now() - 3_600_000) void restore()
    return () => {
      controller.abort()
      activeReviewAbort.current?.abort()
    }
  }, [accountId, missionId, eligible, reviewDate, tier])

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

  function cancelComparison() {
    activeReviewAbort.current?.abort()
    activeReviewAbort.current = null
    pending.current = false
    setPhase('idle')
    setNotice('Comparison cancelled. Your saved step is still here.')
    setNoticeError(false)
  }

  async function compare() {
    if (!eligible || phase !== 'idle' || pending.current) return
    const unmountSignal = request.current?.signal
    const cancelController = new AbortController()
    activeReviewAbort.current = cancelController
    pending.current = true
    setPhase('reviewing')
    setNotice('')
    setNoticeError(false)
    setReview(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== accountId) throw new Error('Reopen Home to check your account.')
      const deadline = AbortSignal.timeout(tier === 'deep' ? 125_000 : 60_000)
      const signals = [cancelController.signal, deadline, ...(unmountSignal ? [unmountSignal] : [])]
      const res = await fetch('/api/delta-review', { method: 'POST', signal: AbortSignal.any(signals), headers: {
        Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ missionId, finishLine, tier }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Could not compare these moves.')
      if (cancelController.signal.aborted || unmountSignal?.aborted) return
      setReview(result.review ?? null)
      setNotice(result.review ? '' : 'The current mission constraints prevent a review. Reopen Mission to check what changed.')
      setNoticeError(false)
    } catch (err) {
      if (cancelController.signal.aborted || unmountSignal?.aborted) return
      setNotice(err instanceof Error && err.name === 'TimeoutError'
        ? 'The comparison timed out. Your saved step is still available.'
        : err instanceof Error ? err.message : 'Could not compare these moves.')
      setNoticeError(true)
    } finally {
      if (activeReviewAbort.current === cancelController) activeReviewAbort.current = null
      pending.current = false
      if (!unmountSignal?.aborted) setPhase('idle')
    }
  }

  async function saveCorrection() {
    if (!reason.trim() || !decision.correction || pending.current) return
    const target = decision.correction
    const signal = request.current?.signal
    pending.current = true
    setPhase('saving')
    setNotice('')
    setNoticeError(false)
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
      if (!signal?.aborted) {
        setNotice('Could not confirm your correction was saved. Your reason is still here.')
        setNoticeError(true)
      }
    } finally {
      pending.current = false
      if (!signal?.aborted) setPhase('idle')
    }
  }

  // Focused Processing Experience: while a real model comparison is in flight,
  // remove competing buttons and technical clutter so the active objective and
  // orb own the stage. Never fabricates progress percentages or fake stages.
  if (phase === 'reviewing') {
    return (
      <section className={styles.processing} aria-label="Comparing moves" role="status">
        <p className={styles.processingMission}>{mission.title}</p>
        <h2 className={styles.processingTitle}>
          {tier === 'deep' ? 'Running deep project review' : 'Comparing next moves'}
        </h2>
        <p className={styles.processingDetail}>
          {tier === 'deep'
            ? 'Deep · draft and independent critique over your saved mission context.'
            : 'Economy · single structured pass over your saved mission context.'}
        </p>
        <button type="button" className={styles.secondary} onClick={cancelComparison}>
          Cancel comparison
        </button>
      </section>
    )
  }

  const provenance = decision.reviewed ? (() => {
    const info = reviewProvenanceSummary(decision.reviewed)
    return (
      <div className={styles.provenanceBlock} aria-label="Review provenance">
        <div className={styles.provenanceMeta}>
          {info.tierLabel && <span className={styles.metaTag}>{info.tierLabel}</span>}
          {info.passLabel && <span className={styles.metaTag}>{info.passLabel}</span>}
          {info.selectionBasis && <span className={styles.metaTag}>{info.selectionBasis}</span>}
          {info.intelligenceLabel && <span className={styles.metaTag}>{info.intelligenceLabel}</span>}
          {info.elapsedLabel && <span className={styles.metaTag}>{info.elapsedLabel}</span>}
          <span className={styles.metaTag}>{info.sourcesSummary}</span>
          {info.cached && <span className={styles.metaTag}>Cached review</span>}
          {info.citedLessons.map(lesson => (
            <span key={lesson.id} className={`${styles.metaTag} ${styles.metaTagLesson}`}>
              Lesson cited · {lesson.label.length > 48 ? `${lesson.label.slice(0, 45).trimEnd()}…` : lesson.label}
            </span>
          ))}
        </div>
        {info.citedSources.length > 0 && (
          <div className={styles.sourceChipList}>
            {info.citedSources.map(source => (
              <details key={source.id} className={styles.sourceChip}>
                <summary>
                  <span className={styles.sourceKind}>{sourceKindLabel(source.kind)}</span>
                  <span>{source.label}</span>
                </summary>
                <div className={styles.sourceChipBody}>
                  <span>{source.status}</span>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noreferrer">Open source link ↗</a>
                  )}
                  <span className={styles.sourceChipId}>ID: {source.id}</span>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    )
  })() : null

  return (
    <HomeContinue
      view={decision.view}
      missionCount={missions?.length ?? 0}
      why={decision.why}
      finishWhen={decision.finishWhen}
      provenance={provenance}
      isProposal={Boolean(decision.reviewed && !decision.followsSaved)}
      onOpenMission={() => onOpen(decision.followsSaved)}
    >
      <div className={styles.actionRow}>
        {/* The recommendation and the commitment are complementary. When the
            proposal differs from an existing unfinished saved action, keep a
            direct, one-tap Resume beside it instead of burying it in reasons or
            the collapsed alternative. */}
        {saved && !decision.followsSaved && (
          <button
            type="button"
            className={`${styles.secondary} ${styles.resumePill}`}
            onClick={() => onOpen(true)}
            aria-label={`Resume your saved step: ${saved.title}`}
          >
            Resume: {saved.title.length > 52 ? `${saved.title.slice(0, 49)}…` : saved.title}
          </button>
        )}
        {eligible && (
          <button
            type="button"
            className={styles.secondary}
            disabled={phase !== 'idle' || correcting}
            onClick={() => void compare()}
          >
            Compare moves with AI
          </button>
        )}
        {decision.correction && (
          <button
            type="button"
            className={styles.secondary}
            disabled={phase !== 'idle'}
            aria-expanded={correcting}
            onClick={() => { setCorrectionTarget(correcting ? null : correctionKey); setReason('') }}
          >
            Correct this move
          </button>
        )}
      </div>

      {correcting && (
        <form className={styles.correctionForm} onSubmit={event => { event.preventDefault(); void saveCorrection() }}>
          <label>
            What makes this move wrong now?
            <textarea className={styles.reason} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} />
          </label>
          <button type="submit" className={styles.secondary} disabled={!reason.trim() || phase !== 'idle'}>
            Save correction
          </button>
        </form>
      )}

      {(phase !== 'idle' || notice) && (
        noticeError ? (
          <div className={styles.interruptedBanner} role="alert">
            <span>{notice}</span>
            {eligible && (
              <button type="button" className={styles.secondary} onClick={() => void compare()}>
                Try again
              </button>
            )}
          </div>
        ) : (
          <p role="status" className={styles.quiet}>
            {phase === 'restoring' ? 'Checking the saved comparison…' : phase === 'saving' ? 'Saving your correction…' : notice}
          </p>
        )
      )}
    </HomeContinue>
  )
}
