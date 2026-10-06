'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession, missionConnectionMessage } from '@/lib/supabase/missionSession'
import { useCapture } from '@/hooks/useCapture'
import type {
  CapacityLevel,
  ContextAvailability,
  DeltaCandidate,
  DeltaCorrection,
  EvidenceRecord,
  Mission,
  MissionEventType,
  MissionState,
  StrategicDelta as Delta,
} from '@/types'
import { beginFieldWork, endFieldWork } from '@/lib/cognitionPresence'
import { clauseTextFor, operationCandidateId } from '@/lib/strategicDelta'
import {
  EMPTY_BOARD,
  abandonMission,
  applyPriorityChallenge,
  captureIdea,
  completeMission,
  findByState,
  pauseMission,
  promoteToPrimary,
  promoteToSecondary,
  reportBlocker,
  reportCapacityMismatch,
  requestPriorityChallenge,
  setFinishLine,
  unblock,
  type ActionResult,
  type MissionBoard,
  type PriorityChallenge,
} from '@/lib/missionLoop'
import { groupByMission, hasConflict, isStale } from '@/lib/evidence'
import { ActionBtn, ActionChip, Badge, Card, Input, SectionSubtitle, SectionTitle, Textarea } from '@/components/ui'
import NextMovePanel from '@/components/NextMovePanel'
import SavedActions from '@/components/SavedActions'
import TaskRouter, { type RoutedActionDraft, type RouteSeed } from '@/components/TaskRouter'
import { nextMoveContextKey } from '@/lib/nextMove'
import type { TaskRouteContext } from '@/lib/taskRouting'
import StrategicDelta, { type DeltaOperationRequest, type DeltaPhase } from '@/components/StrategicDelta'
import type { ConfirmedLesson, LessonConfirmation, ProjectReview, ProjectReviewRequest } from '@/lib/projectReview'

// ─── Supabase row <-> domain mapping ────────────────────────────────────
// missionLoop.ts operates on the camelCase Mission/MissionEvent domain
// shapes; the missions/mission_events tables are snake_case. This module is
// the only place that translates between them.

export interface MissionRow {
  id: string
  user_id: string
  title: string
  why: string
  finish_line: string | null
  evidence_requirement: string | null
  state: MissionState
  blocker: string | null
  capacity_mismatch: boolean
  created_at: string
  updated_at: string
}

export interface EvidenceRow {
  id: string
  mission_id: string | null
  source: string
  kind: EvidenceRecord['kind']
  status: EvidenceRecord['status']
  claim: string
  observed_at: string
  fetched_at: string
}

export function rowToMission(row: MissionRow): Mission {
  return {
    id: row.id,
    title: row.title,
    why: row.why,
    finishLine: row.finish_line,
    evidenceRequirement: row.evidence_requirement,
    state: row.state,
    blocker: row.blocker,
    capacityMismatch: row.capacity_mismatch,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function missionToRow(mission: Mission, userId: string): Omit<MissionRow, 'created_at'> {
  return {
    id: mission.id,
    user_id: userId,
    title: mission.title,
    why: mission.why,
    finish_line: mission.finishLine,
    evidence_requirement: mission.evidenceRequirement,
    state: mission.state,
    blocker: mission.blocker,
    capacity_mismatch: mission.capacityMismatch,
    updated_at: mission.updatedAt,
  }
}

export function rowToEvidence(row: EvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    missionId: row.mission_id,
    source: row.source,
    kind: row.kind,
    status: row.status,
    claim: row.claim,
    observedAt: row.observed_at,
    fetchedAt: row.fetched_at,
  }
}

// Delta corrections live in mission_events — the table's `type` column has
// no CHECK constraint, so the append-only ledger already holds predictions,
// acceptances, and corrections without a migration. `detail` carries the
// corrected move and the reason together so a correction survives reload.
export interface MissionEventRow {
  id: string
  mission_id: string
  type?: string
  detail: string
  created_at: string
}

export function rowToCorrection(row: MissionEventRow): DeltaCorrection | null {
  try {
    const parsed = JSON.parse(row.detail) as { move?: unknown; reason?: unknown; candidateId?: unknown }
    if (typeof parsed.move !== 'string' || typeof parsed.reason !== 'string') return null
    return {
      id: row.id,
      missionId: row.mission_id,
      correctedMove: parsed.move,
      // Absent on corrections recorded before ids were written; those still
      // match on prose.
      candidateId: typeof parsed.candidateId === 'string' ? parsed.candidateId : undefined,
      reason: parsed.reason,
      createdAt: row.created_at,
    }
  } catch {
    return null
  }
}

/** A step the user wrote for one clause. `detail` is
 *  `{ step, targetId, clause }`. The operation id is derived from step and
 *  target, so a reload selects the same candidate the session selected
 *  before it; `clause` is the finish-line clause the step was written for,
 *  which the engine checks against the current finish line. Rows without it
 *  (written only by pre-merge previews of this feature) read back but are
 *  never admitted. */
export function rowToSuppliedStep(row: MissionEventRow): DeltaCandidate | null {
  try {
    const parsed = JSON.parse(row.detail) as { step?: unknown; targetId?: unknown; clause?: unknown }
    if (typeof parsed.step !== 'string' || parsed.step.trim().length === 0) return null
    if (typeof parsed.targetId !== 'string' || !parsed.targetId.startsWith('clause:')) return null
    const step = parsed.step.trim()
    return {
      id: operationCandidateId(parsed.targetId, step),
      kind: 'supplied_operation',
      move: step,
      missionId: row.mission_id,
      targetId: parsed.targetId,
      ...(typeof parsed.clause === 'string' && parsed.clause.trim() ? { clause: parsed.clause } : {}),
      rank: 0,
    }
  } catch {
    return null
  }
}

// An acceptance is agreement with a prediction — never an action and never
// evidence. Rows written before this helper carry the move as plain text;
// newer rows are JSON with the candidate id and the finish line the move was
// accepted under. All read back as the move, which is what the displayed
// Delta is compared against.
export function acceptanceDetail(
  move: string,
  candidateId: string | null | undefined,
  finishLine?: string | null,
): string {
  return JSON.stringify({
    move,
    ...(candidateId ? { candidateId } : {}),
    ...(finishLine ? { finishLine } : {}),
  })
}

export interface LedgerAcceptance {
  move: string
  /** The finish line in force when it was accepted; absent on older rows. */
  finishLine?: string
}

function acceptanceFromDetail(detail: string): LedgerAcceptance | null {
  try {
    const parsed: unknown = JSON.parse(detail)
    if (parsed && typeof parsed === 'object' && typeof (parsed as { move?: unknown }).move === 'string') {
      const { move, finishLine } = parsed as { move: string; finishLine?: unknown }
      if (!move.trim()) return null
      return typeof finishLine === 'string' ? { move, finishLine } : { move }
    }
  } catch {
    // Plain prose — the older format.
  }
  return detail.trim() ? { move: detail } : null
}

// Events that change what the Delta is predicting for a mission. A later one
// means an earlier acceptance was agreement with a prediction that has since
// been replaced, so it must not come back as "Accepted" after reload.
// finish_line_set covers older acceptance rows that did not record their
// finish line (the only in-app way to change a finish line writes it).
const INVALIDATES_ACCEPTANCE = new Set(['delta_corrected', 'delta_step_supplied', 'finish_line_set'])

/** mission id → the latest acceptance still standing in the event ledger:
 *  the newest delta_accepted per mission, unless a correction, supplied step
 *  or finish-line change for that mission came after it. */
export function acceptanceLedger(rows: MissionEventRow[]): Record<string, LedgerAcceptance> {
  const live: Record<string, LedgerAcceptance> = {}
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of ordered) {
    if (row.type === 'delta_accepted') {
      const acceptance = acceptanceFromDetail(row.detail)
      if (acceptance) live[row.mission_id] = acceptance
    } else if (row.type && INVALIDATES_ACCEPTANCE.has(row.type)) {
      delete live[row.mission_id]
    }
  }
  return live
}

/** mission id → accepted move, dropping any acceptance recorded under a
 *  finish line the mission no longer has (a revision made outside this
 *  screen writes no event this session saw). */
export function currentAcceptances(
  ledger: Record<string, LedgerAcceptance>,
  missions?: Record<string, Pick<Mission, 'finishLine'>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [missionId, acceptance] of Object.entries(ledger)) {
    const mission = missions?.[missionId]
    if (missions && acceptance.finishLine !== undefined && mission?.finishLine !== acceptance.finishLine) continue
    out[missionId] = acceptance.move
  }
  return out
}

/** Ledger fold and finish-line check in one step. The UI still shows
 *  "Accepted" only when the move equals the Delta it is displaying. */
export function liveAcceptances(
  rows: MissionEventRow[],
  missions?: Record<string, Pick<Mission, 'finishLine'>>,
): Record<string, string> {
  return currentAcceptances(acceptanceLedger(rows), missions)
}

function withoutMission<T>(entries: Record<string, T>, missionId: string): Record<string, T> {
  if (!(missionId in entries)) return entries
  const next = { ...entries }
  delete next[missionId]
  return next
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const CAPACITY_LEVELS: CapacityLevel[] = ['low', 'medium', 'high']

export const VISITOR_ACCESS_COPY = 'Smart suggestions are only on Eddie\u2019s account. Everything you write here is saved privately.'
const RECONNECT_ACCESS_COPY = 'Smart suggestions are unavailable until this session reconnects. Everything you write here is still saved privately.'

export default function MissionTab() {
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState('Checking session…')
  const [board, setBoard] = useState<MissionBoard>(EMPTY_BOARD)
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [evidenceStatus, setEvidenceStatus] = useState<ContextAvailability>('loading')
  const [corrections, setCorrections] = useState<DeltaCorrection[]>([])
  const [suppliedSteps, setSuppliedSteps] = useState<DeltaCandidate[]>([])
  const [acceptances, setAcceptances] = useState<Record<string, LedgerAcceptance>>({})
  // Re-derived whenever the board changes, so an acceptance recorded under a
  // finish line the mission no longer has is dropped in-session too.
  const acceptedMoves = useMemo(() => currentAcceptances(acceptances, board.missions), [acceptances, board.missions])
  // Accepts in flight, keyed mission+move, so a double tap cannot insert twice
  // before the first write returns.
  const acceptingRef = useRef<Set<string>>(new Set())
  // The accepted move the Delta is actually showing for Primary (reported by
  // StrategicDelta). Distinct from acceptedMoves, which comes from the ledger.
  const [shownAcceptance, setShownAcceptance] = useState<{ missionId: string; move: string; resumeActionId?: string } | null>(null)
  const [routeSeed, setRouteSeed] = useState<RouteSeed | null>(null)
  const [routedDraft, setRoutedDraft] = useState<RoutedActionDraft | null>(null)
  const [routeNotes, setRouteNotes] = useState<{ missionId: string; note: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [connectionError, setConnectionError] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [deltaError, setDeltaError] = useState('')
  // Whether the server has ANTHROPIC_API_KEY set. Checked once, mirroring
  // ConstraintValidatorTab's own GET-before-POST pattern for the same
  // reason: an unconfigured server should never even attempt the call, not
  // just fail it gracefully.
  const [operationStageConfigured, setOperationStageConfigured] = useState(false)
  const [confirmedLessons, setConfirmedLessons] = useState<ConfirmedLesson[]>([])
  const [projectReviewAccessError, setProjectReviewAccessError] = useState<string | null>(null)
  // Who the server says this session is for project intelligence. A 403 is
  // a visitor: the owner-only review routes will refuse them, so the
  // cached-review read is skipped rather than fired just to fail. A 401 is a
  // session the server could not verify (possibly transient), so it is not
  // locked in as a visitor; its reads still run and fail quietly. Any 2xx —
  // including `configured: false` when the model key is missing — is the
  // owner, whose confirmed lessons still restore without a provider key.
  const [projectAccess, setProjectAccess] = useState<'checking' | 'owner' | 'visitor' | 'unknown'>('checking')
  // A failed optional read (restoring a cached review). Shown as a quiet
  // note, never as a failed write.
  const [projectReviewNotice, setProjectReviewNotice] = useState<string | null>(null)
  const [lessonNotice, setLessonNotice] = useState('')
  const [projectReview, setProjectReview] = useState<ProjectReview | null>(null)
  const [projectReviewBusy, setProjectReviewBusy] = useState(false)
  const [projectReviewError, setProjectReviewError] = useState<string | null>(null)
  const [reviewRevision, setReviewRevision] = useState(0)
  const reviewGeneration = useRef(0)
  const reviewInFlight = useRef(false)

  // New-mission form
  const [showNewMission, setShowNewMission] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWhy, setNewWhy] = useState('')
  const [nameTitle, setNameTitle] = useState('')
  const [nameFinish, setNameFinish] = useState('')
  const [nameEvidence, setNameEvidence] = useState('')
  const [resumableMissionId, setResumableMissionId] = useState<string | null>(null)

  // Capture Idea — shared pipeline with ControlsTab; Mission Screen never
  // renders capture.inbox, only writes through it (spec: no full backlog here)
  const capture = useCapture(user)
  const [captureText, setCaptureText] = useState('')

  // Blocker / finish-line / complete inline drafts, keyed by mission id
  const [blockerDraft, setBlockerDraft] = useState('')
  const [finishLineDrafts, setFinishLineDrafts] = useState<Record<string, string>>({})
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, string>>({})
  const [capacityLevel, setCapacityLevel] = useState<CapacityLevel>('low')
  const [completeConfirmed, setCompleteConfirmed] = useState(false)
  const [completeDetail, setCompleteDetail] = useState('')

  // Priority challenge
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [challengeCandidateId, setChallengeCandidateId] = useState('')
  const [challengeWhat, setChallengeWhat] = useState('')
  const [challengeWhy, setChallengeWhy] = useState('')
  const [challengeDisplacedNext, setChallengeDisplacedNext] = useState<'parked' | 'paused' | 'abandoned'>('parked')
  const [pendingChallenge, setPendingChallenge] = useState<PriorityChallenge | null>(null)

  const flash = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 1600)
  }, [])

  const loadAll = useCallback(async (userId: string, isCancelled: () => boolean = () => false) => {
    setEvidenceStatus('loading')
    try {
      const [missionsRes, evidenceRes, correctionsRes] = await Promise.all([
        supabase.from('missions').select('*').eq('user_id', userId),
        supabase.from('evidence_snapshots').select('*'),
        supabase.from('mission_events').select('*').eq('user_id', userId).in('type', ['delta_accepted', 'delta_corrected', 'delta_step_supplied', 'finish_line_set', 'delta_context_added']).order('created_at', { ascending: true }),
      ])
      if (isCancelled()) return
      if (missionsRes.error) throw missionsRes.error
      // Corrections are load-bearing for inhibition (AGENTS.md: persisted
      // corrections "feed back in as an inhibition input"). A failed read
      // must not resolve as "no corrections" — that would let the Delta
      // recommend a move the human already explicitly rejected. Treat it
      // as a load failure, the same as a failed missions read, rather than
      // silently proceeding with stale or empty correction state.
      if (correctionsRes.error) throw correctionsRes.error

      const missions: Record<string, Mission> = {}
      for (const row of (missionsRes.data ?? []) as MissionRow[]) {
        missions[row.id] = rowToMission(row)
      }
      setBoard({ missions })
      const eventRows = (correctionsRes.data ?? []) as Array<MissionEventRow & { type?: string }>
      setRouteNotes(eventRows.filter(row => row.type === 'delta_context_added').map(row => ({ missionId: row.mission_id, note: row.detail })))
      setCorrections(
        eventRows
          .filter(row => row.type === 'delta_corrected')
          .map(rowToCorrection)
          .filter((c): c is DeltaCorrection => c !== null),
      )
      setSuppliedSteps(
        eventRows
          .filter(row => row.type === 'delta_step_supplied')
          .map(rowToSuppliedStep)
          .filter((step): step is DeltaCandidate => step !== null),
      )
      setAcceptances(acceptanceLedger(eventRows))
      setReviewRevision(value => value + 1)

      if (!evidenceRes.error) {
        setEvidence(((evidenceRes.data ?? []) as EvidenceRow[]).map(rowToEvidence))
        setEvidenceStatus('ready')
      } else {
        setEvidenceStatus('unavailable')
      }
      setLoaded(true)
      setLoadFailed(false)
    } catch {
      if (isCancelled()) return
      setEvidenceStatus('unavailable')
      setLoadFailed(true)
      setConnectionError('Could not load your missions. Try again; your saved work has not changed.')
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const current = await connectMissionSession()
        if (cancelled) return
        setUser(current)
        setAuthStatus('Signed in')
        await loadAll(current.id, () => cancelled)
      } catch (connectionFailure) {
        if (!cancelled) {
          setUser(null)
          setLoadFailed(true)
          setConnectionError(missionConnectionMessage(connectionFailure))
          setEvidenceStatus('unavailable')
          setAuthStatus('Missions unavailable — could not connect to your account.')
          setLoaded(true)
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadAll, connectionAttempt])

  function retryConnection() {
    setLoaded(false)
    setLoadFailed(false)
    setConnectionError('')
    setAuthStatus('Reconnecting…')
    setEvidenceStatus('loading')
    setConnectionAttempt(attempt => attempt + 1)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const sessionResult = await supabase.auth.getSession()
        const res = await fetch('/api/delta-review?capabilities=1', {
          headers: sessionResult.data.session?.access_token
            ? { Authorization: `Bearer ${sessionResult.data.session.access_token}` }
            : {},
        })
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) {
            setOperationStageConfigured(false)
            setProjectAccess(res.status === 403 ? 'visitor' : 'unknown')
            setProjectReviewAccessError(res.status === 403 ? VISITOR_ACCESS_COPY : RECONNECT_ACCESS_COPY)
          }
          return
        }
        const data = await res.json() as { configured?: unknown; error?: string }
        if (!cancelled) {
          setOperationStageConfigured(res.ok && data.configured === true)
          setProjectAccess(res.ok ? 'owner' : 'unknown')
          setProjectReviewAccessError(res.ok && data.configured === true ? null : data.error || 'Project intelligence is not configured. Your saved work remains available.')
        }
      } catch {
        if (!cancelled) {
          setOperationStageConfigured(false)
          setProjectAccess('unknown')
          setProjectReviewAccessError('Could not check project intelligence access. Reconnect without clearing your saved work.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [user])

  // Applies a pure missionLoop action, persists the affected missions +
  // event, and rolls the board back on write failure so displayed state
  // never drifts from what Supabase actually holds (spec §8).
  const applyAndPersist = useCallback(
    async (
      run: (b: MissionBoard) => ActionResult,
      affectedIds: string[],
    ) => {
      if (!user) return
      setError('')
      const before = board
      const result = run(before)
      if (result.error) {
        setError(result.error)
        return
      }
      setBoard(result.board)
      beginFieldWork()
      try {
        const rows = affectedIds.map(id => missionToRow(result.board.missions[id], user.id))
        const { error: upsertError } = await supabase.from('missions').upsert(rows, { onConflict: 'id' })
        if (upsertError) throw upsertError

        if (result.event) {
          // supabase-js resolves errors instead of throwing — check them
          // explicitly or a rejected event insert would leave the board
          // ahead of its own history.
          const { error: eventError } = await supabase.from('mission_events').insert({
            id: newId(),
            user_id: user.id,
            mission_id: result.event.missionId,
            type: result.event.type,
            detail: result.event.detail,
            idempotency_key: newId(),
            created_at: result.event.createdAt,
          })
          if (eventError) {
            // The missions upsert above already committed the new state —
            // only the audit event failed. Two writes without a
            // transaction can't both roll back for free, so compensate
            // explicitly: write the pre-image back so what's persisted
            // matches the React state we're about to revert to, rather
            // than silently leaving a change committed that the UI (and
            // the audit trail) both say never happened.
            const compensationRows = affectedIds
              .filter(id => before.missions[id])
              .map(id => missionToRow(before.missions[id], user.id))
            const { error: compensateError } = await supabase
              .from('missions')
              .upsert(compensationRows, { onConflict: 'id' })
            setBoard(before)
            setError(
              compensateError
                ? 'Write partially saved — this change persisted but its history entry did not, and reverting it also failed. Reload before making another change.'
                : 'Write failed — change was not saved. Nothing changed; try again.',
            )
            return
          }
        }
        // A finish-line change replaces the goal an earlier acceptance
        // agreed with; drop it the same way the reload fold does.
        const changedGoal = result.event?.type === 'finish_line_set' ? result.event.missionId : null
        if (changedGoal) setAcceptances(prev => withoutMission(prev, changedGoal))
        flash('Saved')
      } catch {
        setBoard(before)
        setError('Write failed — change was not saved. Nothing changed; try again.')
      } finally {
        endFieldWork()
      }
    },
    [board, user, flash],
  )

  // ─── Strategic Delta ──────────────────────────────────────────────────
  // A Delta is a prediction. Accepting one records that the human agreed —
  // it deliberately does NOT create a row in the canonical `actions` table.
  // AI recommendation is not human commitment, and neither is evidence of
  // completion (spec §14).
  const recordDeltaEvent = useCallback(
    async (type: MissionEventType, missionId: string, detail: string): Promise<boolean> => {
      if (!user) {
        setDeltaError('Could not record that against your history — it was not saved.')
        return false
      }
      beginFieldWork()
      try {
        const { error: writeError } = await supabase.from('mission_events').insert({
          id: newId(),
          user_id: user.id,
          mission_id: missionId,
          type,
          detail,
          idempotency_key: newId(),
          created_at: new Date().toISOString(),
        })
        if (writeError) throw writeError
        setDeltaError('')
        return true
      } catch {
        setDeltaError('Could not record that against your history — it was not saved.')
        return false
      } finally {
        endFieldWork()
      }
    },
    [user],
  )

  // Idempotent per (mission, move): accepting what is already the live
  // acceptance — e.g. after reload, or a second tap — records nothing new.
  // mission_events has no unique constraint to lean on, so this guard is the
  // only thing between a repeat tap and a duplicate row.
  const handleAcceptDelta = useCallback(
    async (delta: Delta): Promise<boolean> => {
      const missionId = delta.missionId
      if (!missionId) return false
      if (acceptedMoves[missionId] === delta.move) return true
      const finishLine = board.missions[missionId]?.finishLine ?? null
      const key = `${missionId}\u0000${delta.move}`
      if (acceptingRef.current.has(key)) return false
      acceptingRef.current.add(key)
      try {
        const ok = await recordDeltaEvent('delta_accepted', missionId, acceptanceDetail(delta.move, delta.candidateId, finishLine))
        if (!ok) return false
        setAcceptances(prev => ({ ...prev, [missionId]: finishLine ? { move: delta.move, finishLine } : { move: delta.move } }))
        return true
      } finally {
        acceptingRef.current.delete(key)
      }
    },
    [acceptedMoves, board, recordDeltaEvent],
  )

  // The corrected prediction is kept, never erased: it stays in
  // mission_events as history and comes back as an inhibition input, so the
  // engine stops recommending it (spec §15). Local state updates only after
  // the write succeeds, so the UI never looks recorded when it wasn't.
  const handleCorrectDelta = useCallback(
    async (delta: Delta, reason: string): Promise<boolean> => {
      if (!delta.missionId) return false
      const ok = await recordDeltaEvent(
        'delta_corrected',
        delta.missionId,
        JSON.stringify({ move: delta.move, reason, candidateId: delta.candidateId }),
      )
      if (!ok) return false
      const correction: DeltaCorrection = {
        id: newId(),
        missionId: delta.missionId,
        correctedMove: delta.move,
        candidateId: delta.candidateId ?? undefined,
        reason,
        createdAt: new Date().toISOString(),
      }
      setCorrections(prev => [...prev, correction])
      setAcceptances(prev => withoutMission(prev, correction.missionId))
      return true
    },
    [recordDeltaEvent],
  )

  // The written step is the operation to evaluate, not a rejection of the
  // fallback sentence. Local state updates only after the write succeeds,
  // in oldest-first order, matching the reload query.
  const handleSupplyStep = useCallback(
    async (delta: Delta, step: string): Promise<boolean> => {
      if (!delta.missionId || !delta.candidateId?.startsWith('clause:')) return false
      // Bind the step to the clause it answers, so a later finish-line
      // revision cannot revive it for a different goal.
      const clause = clauseTextFor(board.missions[delta.missionId]?.finishLine ?? null, delta.candidateId)
      if (!clause) return false
      const detail = JSON.stringify({ step, targetId: delta.candidateId, clause })
      const ok = await recordDeltaEvent('delta_step_supplied', delta.missionId, detail)
      if (!ok) return false
      const supplied = rowToSuppliedStep({
        id: newId(),
        mission_id: delta.missionId,
        type: 'delta_step_supplied',
        detail,
        created_at: new Date().toISOString(),
      })
      if (supplied) setSuppliedSteps(prev => [...prev, supplied])
      const missionId = delta.missionId
      setAcceptances(prev => withoutMission(prev, missionId))
      return true
    },
    [board, recordDeltaEvent],
  )

  const handleDeltaContext = useCallback(
    async (delta: Delta, note: string): Promise<boolean> => {
      // mission_events.mission_id is not null, so there is nowhere to
      // persist a note when nothing is Primary yet — the same constraint
      // that already disables "Not right" in this state. Report failure
      // rather than pretending the note was saved; the control itself is
      // disabled for the same reason, this is defense in depth.
      if (!delta.missionId) return false
      if (note.length > 6_000) {
        setDeltaError('Keep each project note under 6,000 characters. Add another note for more context.')
        return false
      }
      const saved = await recordDeltaEvent('delta_context_added', delta.missionId, note)
      if (saved) {
        setRouteNotes(previous => [...previous, { missionId: delta.missionId!, note }])
        reviewGeneration.current += 1
        setProjectReview(null)
        setReviewRevision(value => value + 1)
      }
      return saved
    },
    [recordDeltaEvent],
  )

  // After a failed read, "Check again" is a reconnect: it resets the failure
  // state the same way retryConnection does, so a later success does not
  // render mission data under a stale "Could not load" alert.
  const handleDeltaRecheck = useCallback(() => {
    if (loadFailed || !user) {
      setLoaded(false)
      setLoadFailed(false)
      setConnectionError('')
      setAuthStatus('Reconnecting…')
      setEvidenceStatus('loading')
      setConnectionAttempt(attempt => attempt + 1)
      return
    }
    void loadAll(user.id)
  }, [user, loadAll, loadFailed])

  const handleResumableAction = useCallback((missionId: string, active: boolean) => {
    setResumableMissionId(active ? missionId : null)
    setReviewRevision(value => value + 1)
  }, [])

  const handleProjectReview = useCallback(async (request: ProjectReviewRequest) => {
    if (reviewInFlight.current) return
    reviewInFlight.current = true
    const generation = ++reviewGeneration.current
    setProjectReviewBusy(true)
    setProjectReview(null)
    setProjectReviewError(null)
    setProjectReviewNotice(null)
    beginFieldWork()
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw new Error('Your session is unavailable. Reconnect without clearing your saved work.')
      const response = await fetch('/api/delta-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(request),
      })
      const data = await response.json() as { review?: ProjectReview | null; lessons?: ConfirmedLesson[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'Project review could not complete.')
      if (generation === reviewGeneration.current) {
        setProjectReview(data.review ?? null)
        setConfirmedLessons(data.lessons ?? [])
      }
    } catch (failure) {
      if (generation === reviewGeneration.current) {
        setProjectReviewError(failure instanceof Error ? failure.message : 'Project review could not complete.')
        // A failed review may have superseded an in-flight restore that already
        // cleared the lessons. Reload human-confirmed lessons so they stay visible.
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              const restore = await fetch(`/api/delta-review?missionId=${encodeURIComponent(request.missionId)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
              if (restore.ok) {
                const restored = await restore.json() as { lessons?: ConfirmedLesson[] }
                if (generation === reviewGeneration.current) setConfirmedLessons(restored.lessons ?? [])
              }
            }
          } catch {
            // Keep the review error visible; lessons reload on the next restore.
          }
        })()
      }
    } finally {
      reviewInFlight.current = false
      setProjectReviewBusy(false)
      endFieldWork()
    }
  }, [])

  // Restore only a cached proposal that the server has checked against
  // current account-scoped notes, corrections, evidence and commitments.
  // Reading a page never initiates a provider call.
  useEffect(() => {
    const generation = ++reviewGeneration.current
    // Hide the external cached proposal as soon as its inputs change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectReview(null)
    setConfirmedLessons([])
    setProjectReviewError(null)
    setProjectReviewNotice(null)
    const primary = findByState(board, 'primary')
    const secondary = findByState(board, 'secondary')
    const target = primary && !primary.blocker && !primary.capacityMismatch ? primary : secondary
    // Cached reasoning and human-confirmed lessons need no provider key.
    // Keep reading/retirement available when generation is unavailable.
    if (!loaded || loadFailed || !user || !target) return
    // Wait for the access check, and never ask the owner-only route on a
    // visitor's behalf: its refusal is expected, not a failure to report.
    if (projectAccess === 'checking' || projectAccess === 'visitor') return
    let cancelled = false
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) throw new Error('Session unavailable.')
        const response = await fetch(`/api/delta-review?missionId=${encodeURIComponent(target.id)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await response.json() as { review?: ProjectReview | null; lessons?: ConfirmedLesson[]; error?: string }
        if (!response.ok) throw new Error(data.error || 'Could not restore the project review.')
        if (!cancelled && generation === reviewGeneration.current) {
          setProjectReview(data.review ?? null)
          setConfirmedLessons(data.lessons ?? [])
        }
      } catch {
        // An optional read: nothing the person wrote failed to record.
        if (!cancelled && generation === reviewGeneration.current) setProjectReviewNotice('A saved project review could not be loaded. Your saved work is unchanged.')
      }
    })()
    return () => { cancelled = true }
  }, [board, corrections, suppliedSteps, loaded, loadFailed, user, reviewRevision, projectAccess])

  useEffect(() => {
    if (!projectReview) return
    const remaining = Date.parse(projectReview.reviewedAt) + 3_600_000 - Date.now()
    const timer = setTimeout(() => setProjectReview(null), Number.isFinite(remaining) ? Math.max(0, remaining) : 0)
    return () => clearTimeout(timer)
  }, [projectReview])

  const handleLessonWrite = useCallback(async (body: object): Promise<boolean> => {
    beginFieldWork()
    setLessonNotice('')
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Your session is unavailable. Reconnect without clearing saved work.')
      const response = await fetch('/api/delta-lessons', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const data = await response.json() as { error?: string; confirmed?: boolean; retired?: boolean }
      if (!response.ok || (!data.confirmed && !data.retired)) throw new Error(data.error || 'The lesson was not recorded.')
      reviewGeneration.current += 1
      setProjectReview(null)
      setReviewRevision(value => value + 1)
      setLessonNotice(data.confirmed ? 'Lesson preserved. The next project review will read it under its stated conditions.' : 'Lesson retired. Its history remains; the next review will exclude it.')
      return true
    } catch (failure) {
      setLessonNotice(failure instanceof Error ? failure.message : 'The lesson could not be recorded.')
      return false
    } finally { endFieldWork() }
  }, [])
  const handleConfirmLesson = useCallback((lesson: LessonConfirmation) => handleLessonWrite({ action: 'confirm', ...lesson }), [handleLessonWrite])
  const handleRetireLesson = useCallback((lessonId: string) => handleLessonWrite({ action: 'retire', lessonId }), [handleLessonWrite])

  // The narrowly bounded model-assist stage: one clause in, one operation
  // (or null) out. Owns auth and the network call so StrategicDelta.tsx
  // stays Supabase-agnostic, same as every other onXxx prop it takes. Never
  // called with anything the caller didn't already have — no browsing, no
  // other users' data.
  // A request failure (network error, 401/403/502, a malformed response)
  // must reject rather than resolve to null — null is reserved for the one
  // legitimate outcome, a well-formed `{ operation: null }` response
  // meaning the model genuinely had nothing to add. Conflating the two
  // made every real outage present as an honest reasoning limit, and left
  // StrategicDelta's own rejection handling unreachable.
  const handleRequestOperation = useCallback(async (req: DeltaOperationRequest): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delta-operation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        missionId: req.missionId,
        missionTitle: req.missionTitle,
        finishLine: req.finishLine,
        clause: req.clause,
        rejectedOperations: req.rejectedOperations,
      }),
    })
    if (!res.ok) throw new Error(`Model operation generation failed (${res.status}).`)
    const data = (await res.json()) as { operation?: unknown }
    if (data.operation !== null && typeof data.operation !== 'string') {
      throw new Error('Model operation generation returned a malformed response.')
    }
    return data.operation
  }, [])

  // Derived from work that is genuinely pending, never a timer. `loaded`
  // is set on every terminal path, including sign-in failure.
  const deltaPhase: DeltaPhase = loaded ? 'resolved' : user ? 'reading' : 'orienting'

  const primary = findByState(board, 'primary')
  const secondary = findByState(board, 'secondary')
  const missionList = Object.values(board.missions)
  // The Delta shows its own "Check again" only for a failed read with nothing
  // to predict from. A later read can fail while earlier missions are still
  // on screen; then the banner keeps the button so a retry is always offered.
  const deltaOffersRecheck = loaded && loadFailed && missionList.length === 0
  const parkedOrCandidate = missionList.filter(m => m.state === 'parked' || m.state === 'candidate')
  const challengeCandidates = missionList.filter(
    m => (m.state === 'parked' || m.state === 'candidate') && m.finishLine,
  )
  const sessionReady = loaded && !!user && !loadFailed
  const confirmedEmpty = sessionReady && missionList.length === 0

  const STATE_LABEL: Record<Mission['state'], string> = {
    candidate: 'Candidate',
    parked: 'Parked',
    primary: 'Primary',
    secondary: 'Secondary',
    blocked: 'Blocked',
    completed: 'Completed',
    paused: 'Paused',
    abandoned: 'Abandoned',
  }

  async function handleNewMission() {
    if (!user || !newTitle.trim()) return
    const id = newId()
    const result = captureIdea(board, { id, title: newTitle, why: newWhy, now: new Date().toISOString() })
    if (result.error) {
      setError(result.error)
      return
    }
    setBoard(result.board)
    beginFieldWork()
    try {
      const { error: missionError } = await supabase.from('missions').insert(missionToRow(result.board.missions[id], user.id))
      if (missionError) throw missionError
      if (result.event) {
        const { error: eventError } = await supabase.from('mission_events').insert({
          id: newId(),
          user_id: user.id,
          mission_id: id,
          type: result.event.type,
          detail: result.event.detail,
          idempotency_key: newId(),
          created_at: result.event.createdAt,
        })
        if (eventError) {
          // The mission row above already committed. Compensate by
          // deleting it rather than leaving a mission that exists in
          // Supabase but not in the capture history this claims failed —
          // mission_events.mission_id cascades on delete, so this is safe
          // even though no event was actually written yet for this row.
          const { error: deleteError } = await supabase.from('missions').delete().eq('id', id)
          setBoard(board)
          setError(
            deleteError
              ? 'Write partially saved — a mission was created but could not be recorded or removed. Reload before continuing.'
              : 'Could not save the new mission — nothing was created. Try again.',
          )
          return
        }
      }
      setNewTitle('')
      setNewWhy('')
      setShowNewMission(false)
      flash('Mission captured — Parked')
    } catch {
      setBoard(board)
      setError('Could not save the new mission — nothing was created. Try again.')
    } finally {
      endFieldWork()
    }
  }

  async function handleNameOutcome() {
    if (!user || !nameTitle.trim() || !nameFinish.trim()) return
    const id = newId()
    const nowIso = new Date().toISOString()
    const captured = captureIdea(board, { id, title: nameTitle, why: '', now: nowIso })
    if (captured.error) {
      setError(captured.error)
      return
    }
    const lined = setFinishLine(captured.board, id, nameFinish, nowIso, nameEvidence)
    if (lined.error) {
      setError(lined.error)
      return
    }
    const promoted = promoteToPrimary(lined.board, id, nowIso)
    if (promoted.error) {
      setError(promoted.error)
      return
    }

    const before = board
    setBoard(promoted.board)
    setError('')
    beginFieldWork()
    try {
      const { error: missionError } = await supabase
        .from('missions')
        .insert(missionToRow(promoted.board.missions[id], user.id))
      if (missionError) throw missionError

      const events = [captured.event, lined.event, promoted.event].filter(
        (event): event is NonNullable<typeof event> => event !== null,
      )
      for (const event of events) {
        const { error: eventError } = await supabase.from('mission_events').insert({
          id: newId(),
          user_id: user.id,
          mission_id: id,
          type: event.type,
          detail: event.detail,
          idempotency_key: newId(),
          created_at: event.createdAt,
        })
        if (eventError) {
          // The mission row already committed its final state (title,
          // finish line, Primary — captureIdea/setFinishLine/promoteToPrimary
          // are folded into one insert above), and any events in this loop
          // before the failing one already wrote too. Compensate by
          // deleting the mission rather than leaving one with only a
          // prefix of its founding history — mission_events cascades on
          // delete, so this cleans up every already-written event for it
          // regardless of how far the loop got.
          const { error: deleteError } = await supabase.from('missions').delete().eq('id', id)
          setBoard(before)
          setError(
            deleteError
              ? 'Write partially saved — a mission was created but could not be fully recorded or removed. Reload before continuing.'
              : 'Could not save the new mission — nothing was created. Try again.',
          )
          return
        }
      }
      setNameTitle('')
      setNameFinish('')
      setNameEvidence('')
    } catch {
      setBoard(before)
      setError('Could not save the new mission — nothing was created. Try again.')
    } finally {
      endFieldWork()
    }
  }

  async function handleCaptureIdea() {
    const text = captureText.trim()
    if (!text || !user) return
    beginFieldWork()
    try {
      const saved = capture.capture(text)
      setCaptureText('')
      flash('Captured — Parked in your inbox')
      await saved
    } finally {
      endFieldWork()
    }
  }

  function requestChallenge() {
    if (!primary || !challengeCandidateId) return
    const { challenge, error: reqError } = requestPriorityChallenge(board, {
      candidateMissionId: challengeCandidateId,
      displacedMissionId: primary.id,
      what: challengeWhat,
      why: challengeWhy,
    })
    if (reqError) {
      setError(reqError)
      return
    }
    setPendingChallenge(challenge)
  }

  async function confirmChallenge() {
    if (!pendingChallenge) return
    const candidateId = pendingChallenge.candidateMissionId
    const displacedId = pendingChallenge.displacedMissionId
    await applyAndPersist(
      b => applyPriorityChallenge(b, pendingChallenge, challengeDisplacedNext, new Date().toISOString()),
      [candidateId, displacedId],
    )
    setPendingChallenge(null)
    setChallengeOpen(false)
    setChallengeCandidateId('')
    setChallengeWhat('')
    setChallengeWhy('')
  }

  const evidenceGroups = groupByMission(evidence)
  const primaryEvidence = primary ? evidenceGroups.get(primary.id) ?? [] : []
  // An explicit Delta handoff keeps its actual target, including Secondary.
  // If that target disappears it must not silently retarget to Primary.
  const routeMission = routeSeed ? board.missions[routeSeed.missionId] ?? null : primary ?? null
  const routeContext: TaskRouteContext = {
    mission: routeMission,
    missionStatus: !loaded ? 'loading' : loadFailed || !user ? 'unavailable' : 'ready',
    evidence, evidenceStatus,
    learningRevision: reviewRevision,
    corrections: sessionReady ? corrections.filter(item => item.missionId === routeMission?.id).map(item => ({ correctedMove: item.correctedMove, reason: item.reason })) : [],
    contextNotes: sessionReady ? routeNotes.filter(item => item.missionId === routeMission?.id).map(item => item.note) : [],
  }
  const currentDraft = routedDraft && routedDraft.missionId === routeMission?.id
    && routedDraft.contextKey === nextMoveContextKey(routeContext, new Date().toISOString()) ? routedDraft : null
  // Keep the action panel on the same actionable mission while a review
  // restores. Otherwise a Secondary resume remounts Primary's panel, whose
  // read invalidates the review again, producing a restore/remount loop.
  const actionTarget = primary && !primary.blocker && !primary.capacityMismatch ? primary : secondary ?? primary
  const savedMissionId = currentDraft?.missionId ?? shownAcceptance?.missionId ?? actionTarget?.id
  const stage: 'idea' | 'recommendation' | 'commitment' =
    sessionReady && savedMissionId && resumableMissionId === savedMissionId
      ? 'commitment'
      : sessionReady && savedMissionId
        ? 'recommendation'
        : 'idea'
  const now = new Date().toISOString()

  return (
    <section className="mission-space">
      <span className="session-status" role="status">
        <span className={loaded && user && !loadFailed ? 'session-dot connected' : 'session-dot'} aria-hidden="true" />
        {!loaded ? authStatus : loadFailed ? 'Missions unavailable' : user ? 'Connected' : authStatus}
      </span>
      {status && <p className="mission-status" role="status">{status}</p>}
      {error && <p className="mission-status" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
      {connectionError && (
        <div className="mission-status" role="alert">
          <p>{connectionError}</p>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {/* The Strategic Delta offers the same retry once a read has failed and it has no mission to predict from; one label, one button. */}
            {!deltaOffersRecheck && <ActionBtn onClick={retryConnection}>Check again</ActionBtn>}
            <a href="https://legacy-codex.vercel.app">Open main Legacy Codex site</a>
          </div>
        </div>
      )}

      {sessionReady && (
        <ol className="mission-path" aria-label="From idea to saved action">
          <li aria-current={stage === 'idea' ? 'step' : undefined}>
            <span>Idea</span>
            <small>What you are finishing</small>
          </li>
          <li aria-current={stage === 'recommendation' ? 'step' : undefined}>
            <span>Recommendation</span>
            <small>A prediction, not a commitment</small>
          </li>
          <li aria-current={stage === 'commitment' ? 'step' : undefined}>
            <span>Saved action</span>
            <small>What you can resume</small>
          </li>
        </ol>
      )}

      {/* The next-move guide: resolves from real state before the
          user types anything, and renders during the load so its reasoning
          state reflects work that is actually pending. */}
      <StrategicDelta
        missions={Object.values(board.missions)}
        evidence={evidence}
        corrections={corrections}
        phase={deltaPhase}
        acceptedMoves={acceptedMoves}
        onShownAcceptance={setShownAcceptance}
        onRoute={delta => {
          if (delta.missionId) setRouteSeed(previous => ({ task: delta.move, missionId: delta.missionId!, sequence: (previous?.sequence ?? 0) + 1 }))
        }}
        readAvailable={loaded && !loadFailed}
        persistError={deltaError}
        onAccept={handleAcceptDelta}
        onCorrect={handleCorrectDelta}
        onSupplyStep={handleSupplyStep}
        suppliedOperations={suppliedSteps}
        onContextAdded={handleDeltaContext}
        onRecheck={handleDeltaRecheck}
        requestOperation={operationStageConfigured ? handleRequestOperation : undefined}
        projectReview={projectReview}
        confirmedLessons={confirmedLessons}
        onConfirmLesson={handleConfirmLesson}
        onRetireLesson={handleRetireLesson}
        projectReviewAccessError={projectReviewAccessError}
        projectReviewAvailable={operationStageConfigured}
        projectReviewBusy={projectReviewBusy}
        projectReviewError={projectReviewError}
        projectReviewNotice={projectReviewNotice}
        requestProjectReview={sessionReady && (projectAccess === 'owner' || projectAccess === 'unknown') ? handleProjectReview : undefined}
      >
        {confirmedEmpty ? (
          <form
            className="mission-invite"
            onSubmit={event => {
              event.preventDefault()
              void handleNameOutcome()
            }}
          >
            <div className="mission-invite-field">
              <label htmlFor="mission-outcome">Your idea or project</label>
              <Textarea
                id="mission-outcome"
                name="outcome"
                className="mission-invite-input"
                autoComplete="off"
                required
                rows={3}
                placeholder="A real project, in your words"
                value={nameTitle}
                onChange={setNameTitle}
              />
            </div>
            <div className="mission-invite-field">
              <label htmlFor="mission-finish">How you will know it is done</label>
              <Input
                id="mission-finish"
                name="finish_line"
                className="mission-invite-input"
                autoComplete="off"
                required
                placeholder="An observable finish line"
                value={nameFinish}
                onChange={setNameFinish}
              />
            </div>
            <div className="mission-invite-field">
              <label htmlFor="mission-evidence">What will prove it is done</label>
              <Input
                id="mission-evidence"
                name="evidence_requirement"
                className="mission-invite-input"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="Optional — the proof that closes it (a link, a screenshot, a merged PR)"
                value={nameEvidence}
                onChange={setNameEvidence}
              />
            </div>
            <ActionBtn
              type="submit"
              disabled={!nameTitle.trim() || !nameFinish.trim()}
            >
              This is what matters
            </ActionBtn>
          </form>
        ) : null}
      </StrategicDelta>

      {/* The router comes after the next move, not before it: on a phone its
          composer and preferences pushed the card's one action (first-run
          "This is what matters", or "Check again") far below the tab bar.
          "Route this move" still scrolls the composer into view. */}
      <TaskRouter
        context={routeContext}
        accountId={sessionReady ? user.id : null}
        seed={routeSeed}
        canSave={sessionReady && (routeMission?.state === 'primary' || routeMission?.state === 'secondary')}
        onPrepare={setRoutedDraft}
      />

      {lessonNotice && <p role="status" className="mission-status">{lessonNotice}</p>}

      {/* Accepting a Delta is a prediction, not a commitment — SavedActions
          is where accepting one turns into a tracked, resumable action with
          status and a place to leave yourself a note. */}
      {/* Bound to the mission of the accepted move on screen — the Primary,
          or an actionable Secondary when that is what the Delta aimed at. */}
      {sessionReady && savedMissionId && (
        <SavedActions
          key={savedMissionId}
          missionId={savedMissionId}
          suggestedTitle={shownAcceptance && !shownAcceptance.resumeActionId && shownAcceptance.missionId === savedMissionId ? shownAcceptance.move : null}
          routedDraft={currentDraft}
          onActiveChange={handleResumableAction}
        />
      )}

      {!loaded ? (
        <p className="mission-status">Loading missions…</p>
      ) : !sessionReady ? null : confirmedEmpty ? (
        <details className="mission-disclosure">
          <summary>Park an idea you are not ready to commit</summary>
          <div className="mission-park">
            <p>
              Parking stores the words without making them the one thing that matters, and without asking for a next move.
            </p>
            <div className="mission-invite-field">
              <label htmlFor="parked-idea">The idea to park</label>
              <Input id="parked-idea" value={newTitle} onChange={setNewTitle} placeholder="Something to keep, not to start" />
            </div>
            <ActionBtn disabled={!newTitle.trim()} onClick={handleNewMission}>Park this idea</ActionBtn>
            <div className="mission-invite-field">
              <label htmlFor="capture-idea">Or capture it in a sentence</label>
              <Input id="capture-idea" value={captureText} onChange={setCaptureText} placeholder="Say it in your own words" />
            </div>
            <ActionBtn disabled={!captureText.trim()} onClick={handleCaptureIdea}>Capture</ActionBtn>
            {capture.status && <p role="status">{capture.status}</p>}
          </div>
        </details>
      ) : (
        <>
          <section className="mission-index" aria-label="Your missions">
            <h2>Your missions</h2>
            <ul>
              {missionList.map(mission => (
                <li key={mission.id}>
                  <span className="mission-index-state">{STATE_LABEL[mission.state]}</span>
                  <span className="mission-index-title">{mission.title}</span>
                </li>
              ))}
            </ul>
          </section>
          {/* "Right Now" used to live here. The Strategic Delta above states
              the same thing and carries provenance and controls, so keeping
              both showed the user one sentence twice. */}

          {primary && (
            <details className="mission-disclosure">
              <summary>Review your Primary mission</summary>
              <Card>
                <SectionTitle>Primary Mission</SectionTitle>
                <div className="space-y-3">
                  <div>
                    <div style={{ fontWeight: 700 }}>{primary.title}</div>
                    {primary.why && <div style={{ color: 'var(--text-soft)', fontSize: '0.85rem', marginTop: 4 }}>{primary.why}</div>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>
                    <strong>Finish line:</strong> {primary.finishLine ?? 'not set'}
                  </div>
                  {primary.evidenceRequirement && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>
                      <strong>Evidence required:</strong> {primary.evidenceRequirement}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    {primary.blocker ? (
                      <Badge tone="amber" wrap>Blocked: {primary.blocker}</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                    {primary.capacityMismatch && <Badge tone="muted">Capacity mismatch reported</Badge>}
                  </div>

                  {primary.blocker ? (
                    <ActionChip onClick={() => applyAndPersist(b => unblock(b, primary.id, now), [primary.id])}>
                      Unblock — resume as Primary
                    </ActionChip>
                  ) : (
                    <div className="flex gap-2">
                      <Input placeholder="What's blocking this?" value={blockerDraft} onChange={setBlockerDraft} />
                      <ActionChip
                        disabled={!blockerDraft.trim()}
                        onClick={() => {
                          applyAndPersist(b => reportBlocker(b, primary.id, blockerDraft, now), [primary.id])
                          setBlockerDraft('')
                        }}
                      >
                        Report blocker
                      </ActionChip>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={capacityLevel}
                      onChange={e => setCapacityLevel(e.target.value as CapacityLevel)}
                      style={{ minHeight: 44, borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0 8px', font: 'inherit', fontSize: '0.8rem' }}
                      aria-label="Self-reported capacity"
                    >
                      {CAPACITY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ActionChip
                      onClick={() => applyAndPersist(b => reportCapacityMismatch(b, primary.id, capacityLevel, now), [primary.id])}
                    >
                      Does not fit my capacity right now
                    </ActionChip>
                  </div>

                  <details>
                    <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-dim)' }}>Complete this mission</summary>
                    <div className="space-y-2 mt-2">
                      <label className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                        <input type="checkbox" checked={completeConfirmed} onChange={e => setCompleteConfirmed(e.target.checked)} style={{ width: 18, height: 18 }} />
                        I have real evidence this is done (merged PR, live URL, delivered artifact)
                      </label>
                      <Input placeholder="Evidence detail (link, PR #, artifact)" value={completeDetail} onChange={setCompleteDetail} />
                      <ActionBtn
                        disabled={!completeConfirmed || !completeDetail.trim()}
                        onClick={() => {
                          applyAndPersist(
                            b => completeMission(b, primary.id, { evidenceConfirmed: completeConfirmed, evidenceDetail: completeDetail }, now),
                            [primary.id],
                          )
                          setCompleteConfirmed(false)
                          setCompleteDetail('')
                        }}
                      >
                        Mark Completed
                      </ActionBtn>
                    </div>
                  </details>

                  <div className="flex gap-2">
                    <ActionChip variant="ghost" onClick={() => applyAndPersist(b => pauseMission(b, primary.id, 'Deliberately paused', now), [primary.id])}>
                      Deliberately pause
                    </ActionChip>
                    <ActionChip variant="danger" onClick={() => applyAndPersist(b => abandonMission(b, primary.id, 'Abandoned', now), [primary.id])}>
                      Abandon
                    </ActionChip>
                  </div>

                  {challengeCandidates.length > 0 && (
                    <div className="pt-2" style={{ borderTop: '1px solid var(--line)' }}>
                      {!challengeOpen ? (
                        <ActionChip onClick={() => setChallengeOpen(true)}>Priority challenge</ActionChip>
                      ) : !pendingChallenge ? (
                        <div className="space-y-2">
                          <select
                            value={challengeCandidateId}
                            onChange={e => setChallengeCandidateId(e.target.value)}
                            style={{ width: '100%', minHeight: 44, borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', padding: '0 8px', font: 'inherit' }}
                          >
                            <option value="">Which mission should replace {primary.title}?</option>
                            {challengeCandidates.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                          </select>
                          <Input placeholder="What changes?" value={challengeWhat} onChange={setChallengeWhat} />
                          <Input placeholder="Why does it change?" value={challengeWhy} onChange={setChallengeWhy} />
                          <div className="flex gap-2">
                            <ActionChip disabled={!challengeCandidateId || !challengeWhat.trim() || !challengeWhy.trim()} onClick={requestChallenge}>
                              Preview challenge
                            </ActionChip>
                            <ActionChip variant="ghost" onClick={() => setChallengeOpen(false)}>Cancel</ActionChip>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 p-3 rounded-codex" style={{ border: '1px solid var(--amber)', background: 'var(--amber-soft)' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong>What:</strong> {pendingChallenge.what}
                          </div>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong>Why:</strong> {pendingChallenge.why}
                          </div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {primary.title} moves to:
                            <select
                              value={challengeDisplacedNext}
                              onChange={e => setChallengeDisplacedNext(e.target.value as typeof challengeDisplacedNext)}
                              style={{ marginLeft: 8, minHeight: 36, borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', font: 'inherit' }}
                            >
                              <option value="parked">Parked</option>
                              <option value="paused">Deliberately Paused</option>
                              <option value="abandoned">Abandoned</option>
                            </select>
                          </label>
                          <div className="flex gap-2">
                            <ActionBtn onClick={confirmChallenge}>Apply — replace Primary</ActionBtn>
                            <ActionChip variant="ghost" onClick={() => { setPendingChallenge(null); setChallengeOpen(false) }}>Cancel</ActionChip>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </details>
          )}

          {/* Secondary Mission */}
          <details className="mission-disclosure">
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Secondary Mission {secondary ? `— ${secondary.title}` : '(none active)'}
            </summary>
            <Card style={{ marginTop: 8 }}>
              {secondary ? (
                <div className="space-y-2">
                  <div style={{ fontWeight: 700 }}>{secondary.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>{secondary.finishLine}</div>
                  <ActionChip variant="ghost" onClick={() => applyAndPersist(b => pauseMission(b, secondary.id, 'Deliberately paused', now), [secondary.id])}>
                    Pause
                  </ActionChip>
                </div>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  Secondary only becomes actionable once Primary is genuinely Blocked, or you report a capacity mismatch against it.
                  {primary && (primary.blocker || primary.capacityMismatch) && parkedOrCandidate.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {parkedOrCandidate.filter(m => m.finishLine).map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <span>{m.title}</span>
                          <ActionChip
                            onClick={() =>
                              applyAndPersist(
                                b => promoteToSecondary(b, m.id, primary.blocker ? 'primary_blocked' : 'capacity_mismatch', now),
                                [m.id],
                              )
                            }
                          >
                            Promote to Secondary
                          </ActionChip>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </details>

          {/* Typing what feels stuck is now the exception path, not the way
              in: the Delta predicts from state before the user types. This
              stays for manual recalibration and for when prediction has
              nothing to go on. */}
          <details className="mission-disclosure">
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Choose the next move manually
            </summary>
            <div style={{ marginTop: 8 }}>
              <NextMovePanel
                embedded
                context={{
                  mission: primary,
                  missionStatus: !loaded ? 'loading' : !user || loadFailed ? 'unavailable' : 'ready',
                  evidence: primaryEvidence,
                  evidenceStatus,
                }}
              />
            </div>
          </details>

          {/* Parked / Candidate — where new missions get a finish line and become Primary */}
          <Card>
            <SectionTitle>Parked</SectionTitle>
            <SectionSubtitle>New ideas land here by default. Give one a finish line to make it eligible for Primary.</SectionSubtitle>
            {parkedOrCandidate.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Nothing parked.</div>
            ) : (
              <div className="space-y-2">
                {parkedOrCandidate.map(m => (
                  <div key={m.id} className="p-3 rounded-codex space-y-2" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.title}</div>
                    {m.finishLine ? (
                      <>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Finish line: {m.finishLine}</div>
                        {m.evidenceRequirement && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Evidence required: {m.evidenceRequirement}</div>
                        )}
                        {!primary && (
                          <ActionChip onClick={() => applyAndPersist(b => promoteToPrimary(b, m.id, now), [m.id])}>
                            Promote to Primary
                          </ActionChip>
                        )}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          placeholder="Exact finish line…"
                          aria-label={`Finish line for ${m.title}`}
                          value={finishLineDrafts[m.id] ?? ''}
                          onChange={v => setFinishLineDrafts(prev => ({ ...prev, [m.id]: v }))}
                        />
                        <Input
                          placeholder="What will prove it is done (optional)"
                          aria-label={`Evidence requirement for ${m.title}`}
                          value={evidenceDrafts[m.id] ?? ''}
                          onChange={v => setEvidenceDrafts(prev => ({ ...prev, [m.id]: v }))}
                        />
                        <ActionChip
                          disabled={!(finishLineDrafts[m.id] ?? '').trim()}
                          onClick={() => {
                            applyAndPersist(
                              b => setFinishLine(b, m.id, finishLineDrafts[m.id] ?? '', now, evidenceDrafts[m.id] ?? ''),
                              [m.id],
                            )
                            setFinishLineDrafts(prev => ({ ...prev, [m.id]: '' }))
                            setEvidenceDrafts(prev => ({ ...prev, [m.id]: '' }))
                          }}
                        >
                          Set
                        </ActionChip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              {!showNewMission ? (
                <ActionChip onClick={() => setShowNewMission(true)}>New mission</ActionChip>
              ) : (
                <div className="space-y-2">
                  <Input placeholder="Mission title" value={newTitle} onChange={setNewTitle} />
                  <Input placeholder="Why it matters (optional)" value={newWhy} onChange={setNewWhy} />
                  <div className="flex gap-2">
                    <ActionBtn disabled={!newTitle.trim()} onClick={handleNewMission}>Capture</ActionBtn>
                    <ActionChip variant="ghost" onClick={() => setShowNewMission(false)}>Cancel</ActionChip>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Capture Idea */}
          <Card>
            <SectionTitle>Capture Idea</SectionTitle>
            <SectionSubtitle>Say it in your own words. It is Parked by default — this does not interrupt Primary.</SectionSubtitle>
            <div className="flex gap-2">
              <Input placeholder="Type the idea…" value={captureText} onChange={setCaptureText} />
              <ActionBtn disabled={!captureText.trim()} onClick={handleCaptureIdea}>Capture</ActionBtn>
            </div>
            {capture.status && <p role="status">{capture.status}</p>}
          </Card>

          {/* Evidence Status */}
          <details className="mission-disclosure">
            <summary>Evidence behind your focus</summary>
            <Card>
              <SectionTitle>Evidence Status</SectionTitle>
              {primaryEvidence.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No evidence linked to the Primary mission yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {hasConflict(primaryEvidence) && <Badge tone="error">Conflict — sources disagree</Badge>}
                  {primaryEvidence.map(rec => (
                    <div key={rec.id} className="p-2 rounded-codex" style={{ border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
                      <div style={{ fontSize: '0.85rem' }}>{rec.claim}</div>
                      <div className="flex gap-2 mt-1 flex-wrap items-center" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        <Badge tone={rec.status === 'verified' ? 'success' : rec.status === 'conflict' ? 'error' : 'muted'}>{rec.status}</Badge>
                        <span>{rec.source}</span>
                        <span>{new Date(rec.fetchedAt).toLocaleString()}</span>
                        {isStale(rec.fetchedAt, now) && <Badge tone="amber">Stale</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </details>
        </>
      )}
    </section>
  )
}
