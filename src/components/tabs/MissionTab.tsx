'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { operationCandidateId } from '@/lib/strategicDelta'
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
import StrategicDelta, { type DeltaOperationRequest, type DeltaPhase } from '@/components/StrategicDelta'

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

/** A step the user wrote for one clause. `detail` is `{ step, targetId }`.
 *  The operation id is derived from those two fields, so a reload selects
 *  the same candidate the session selected before it. */
export function rowToSuppliedStep(row: MissionEventRow): DeltaCandidate | null {
  try {
    const parsed = JSON.parse(row.detail) as { step?: unknown; targetId?: unknown }
    if (typeof parsed.step !== 'string' || parsed.step.trim().length === 0) return null
    if (typeof parsed.targetId !== 'string' || !parsed.targetId.startsWith('clause:')) return null
    const step = parsed.step.trim()
    return {
      id: operationCandidateId(parsed.targetId, step),
      kind: 'supplied_operation',
      move: step,
      missionId: row.mission_id,
      targetId: parsed.targetId,
      rank: 0,
    }
  } catch {
    return null
  }
}

// An acceptance is agreement with a prediction — never an action and never
// evidence. Rows written before this helper carry the move as plain text;
// newer rows are JSON with the candidate id alongside. Both read back as
// the move, which is what the displayed Delta is compared against.
export function acceptanceDetail(move: string, candidateId: string | null | undefined): string {
  return JSON.stringify(candidateId ? { move, candidateId } : { move })
}

function acceptedMoveFromDetail(detail: string): string | null {
  try {
    const parsed: unknown = JSON.parse(detail)
    if (parsed && typeof parsed === 'object' && typeof (parsed as { move?: unknown }).move === 'string') {
      const move = (parsed as { move: string }).move
      return move.trim() ? move : null
    }
  } catch {
    // Plain prose — the older format.
  }
  return detail.trim() ? detail : null
}

// Events that change what the Delta is predicting for a mission. A later one
// means an earlier acceptance was agreement with a prediction that has since
// been replaced, so it must not come back as "Accepted" after reload.
const INVALIDATES_ACCEPTANCE = new Set(['delta_corrected', 'delta_step_supplied'])

/** mission id → the move currently accepted for it. Folds the event ledger
 *  oldest-first: the latest delta_accepted per mission is live unless a
 *  correction or supplied step for that same mission came after it. The UI
 *  still shows "Accepted" only when this equals the Delta it is displaying,
 *  so a re-prediction that changes the move clears it without a write. */
export function liveAcceptances(rows: MissionEventRow[]): Record<string, string> {
  const live: Record<string, string> = {}
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of ordered) {
    if (row.type === 'delta_accepted') {
      const move = acceptedMoveFromDetail(row.detail)
      if (move) live[row.mission_id] = move
    } else if (row.type && INVALIDATES_ACCEPTANCE.has(row.type)) {
      delete live[row.mission_id]
    }
  }
  return live
}

function withoutMission(moves: Record<string, string>, missionId: string): Record<string, string> {
  if (!(missionId in moves)) return moves
  const next = { ...moves }
  delete next[missionId]
  return next
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const CAPACITY_LEVELS: CapacityLevel[] = ['low', 'medium', 'high']

export default function MissionTab() {
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState('Checking session…')
  const [board, setBoard] = useState<MissionBoard>(EMPTY_BOARD)
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [evidenceStatus, setEvidenceStatus] = useState<ContextAvailability>('loading')
  const [corrections, setCorrections] = useState<DeltaCorrection[]>([])
  const [suppliedSteps, setSuppliedSteps] = useState<DeltaCandidate[]>([])
  const [acceptedMoves, setAcceptedMoves] = useState<Record<string, string>>({})
  // Accepts in flight, keyed mission+move, so a double tap cannot insert twice
  // before the first write returns.
  const acceptingRef = useRef<Set<string>>(new Set())
  // The accepted move the Delta is actually showing for Primary (reported by
  // StrategicDelta). Distinct from acceptedMoves, which is the ledger.
  const [shownAcceptance, setShownAcceptance] = useState<string | null>(null)
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

  // New-mission form
  const [showNewMission, setShowNewMission] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWhy, setNewWhy] = useState('')
  const [nameTitle, setNameTitle] = useState('')
  const [nameFinish, setNameFinish] = useState('')
  const [resumableMissionId, setResumableMissionId] = useState<string | null>(null)

  // Capture Idea — shared pipeline with ControlsTab; Mission Screen never
  // renders capture.inbox, only writes through it (spec: no full backlog here)
  const capture = useCapture(user)
  const [captureText, setCaptureText] = useState('')

  // Blocker / finish-line / complete inline drafts, keyed by mission id
  const [blockerDraft, setBlockerDraft] = useState('')
  const [finishLineDrafts, setFinishLineDrafts] = useState<Record<string, string>>({})
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
        supabase.from('mission_events').select('*').eq('user_id', userId).in('type', ['delta_accepted', 'delta_corrected', 'delta_step_supplied']).order('created_at', { ascending: true }),
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
      setAcceptedMoves(liveAcceptances(eventRows))

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
        const res = await fetch('/api/delta-operation', {
          headers: sessionResult.data.session?.access_token
            ? { Authorization: `Bearer ${sessionResult.data.session.access_token}` }
            : {},
        })
        const data = await res.json() as { configured?: unknown }
        if (!cancelled) setOperationStageConfigured(res.ok && data.configured === true)
      } catch {
        if (!cancelled) setOperationStageConfigured(false)
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
      const key = `${missionId}\u0000${delta.move}`
      if (acceptingRef.current.has(key)) return false
      acceptingRef.current.add(key)
      try {
        const ok = await recordDeltaEvent('delta_accepted', missionId, acceptanceDetail(delta.move, delta.candidateId))
        if (!ok) return false
        setAcceptedMoves(prev => ({ ...prev, [missionId]: delta.move }))
        return true
      } finally {
        acceptingRef.current.delete(key)
      }
    },
    [acceptedMoves, recordDeltaEvent],
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
      setAcceptedMoves(prev => withoutMission(prev, correction.missionId))
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
      const detail = JSON.stringify({ step, targetId: delta.candidateId })
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
      setAcceptedMoves(prev => withoutMission(prev, missionId))
      return true
    },
    [recordDeltaEvent],
  )

  const handleDeltaContext = useCallback(
    async (delta: Delta, note: string): Promise<boolean> => {
      // mission_events.mission_id is not null, so there is nowhere to
      // persist a note when nothing is Primary yet — the same constraint
      // that already disables "Not right" in this state. Report failure
      // rather than pretending the note was saved; the control itself is
      // disabled for the same reason, this is defense in depth.
      if (!delta.missionId) return false
      return recordDeltaEvent('delta_context_added', delta.missionId, note)
    },
    [recordDeltaEvent],
  )

  const handleDeltaRecheck = useCallback(() => {
    if (user) void loadAll(user.id)
  }, [user, loadAll])

  const handleResumableAction = useCallback((missionId: string, active: boolean) => {
    setResumableMissionId(active ? missionId : null)
  }, [])

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
  const parkedOrCandidate = missionList.filter(m => m.state === 'parked' || m.state === 'candidate')
  const challengeCandidates = missionList.filter(
    m => (m.state === 'parked' || m.state === 'candidate') && m.finishLine,
  )
  const sessionReady = loaded && !!user && !loadFailed
  const confirmedEmpty = sessionReady && missionList.length === 0
  const stage: 'idea' | 'recommendation' | 'commitment' =
    sessionReady && primary && resumableMissionId === primary.id
      ? 'commitment'
      : sessionReady && primary
        ? 'recommendation'
        : 'idea'

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
    const lined = setFinishLine(captured.board, id, nameFinish, nowIso)
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
            <ActionBtn onClick={retryConnection}>Try connection again</ActionBtn>
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

      {/* The predictive front door: resolves from real state before the
          user types anything, and renders during the load so its reasoning
          state reflects work that is actually pending. */}
      <StrategicDelta
        missions={Object.values(board.missions)}
        evidence={evidence}
        corrections={corrections}
        phase={deltaPhase}
        acceptedMoves={acceptedMoves}
        onShownAcceptance={setShownAcceptance}
        readAvailable={loaded && !loadFailed}
        persistError={deltaError}
        onAccept={handleAcceptDelta}
        onCorrect={handleCorrectDelta}
        onSupplyStep={handleSupplyStep}
        suppliedOperations={suppliedSteps}
        onContextAdded={handleDeltaContext}
        onRecheck={handleDeltaRecheck}
        requestOperation={operationStageConfigured ? handleRequestOperation : undefined}
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
                rows={5}
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
                enterKeyHint="done"
                required
                placeholder="The observable thing that means it is finished"
                value={nameFinish}
                onChange={setNameFinish}
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

      {/* Accepting a Delta is a prediction, not a commitment — SavedActions
          is where accepting one turns into a tracked, resumable action with
          status and a place to leave yourself a note. */}
      {sessionReady && primary && (
        <SavedActions
          key={primary.id}
          missionId={primary.id}
          suggestedTitle={shownAcceptance}
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
                        {!primary && (
                          <ActionChip onClick={() => applyAndPersist(b => promoteToPrimary(b, m.id, now), [m.id])}>
                            Promote to Primary
                          </ActionChip>
                        )}
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Exact finish line…"
                          value={finishLineDrafts[m.id] ?? ''}
                          onChange={v => setFinishLineDrafts(prev => ({ ...prev, [m.id]: v }))}
                        />
                        <ActionChip
                          disabled={!(finishLineDrafts[m.id] ?? '').trim()}
                          onClick={() => {
                            applyAndPersist(b => setFinishLine(b, m.id, finishLineDrafts[m.id] ?? '', now), [m.id])
                            setFinishLineDrafts(prev => ({ ...prev, [m.id]: '' }))
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
