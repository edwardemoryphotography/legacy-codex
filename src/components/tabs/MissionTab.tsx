'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession, missionConnectionMessage } from '@/lib/supabase/missionSession'
import { useCapture } from '@/hooks/useCapture'
import type {
  CapacityLevel,
  ContextAvailability,
  DeltaCorrection,
  EvidenceRecord,
  Mission,
  MissionEventType,
  MissionState,
  StrategicDelta as Delta,
} from '@/types'
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
import { ActionBtn, ActionChip, Badge, Card, Input, SectionSubtitle, SectionTitle } from '@/components/ui'
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
  const [acceptedMove, setAcceptedMove] = useState<string | null>(null)
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
        supabase.from('mission_events').select('*').eq('user_id', userId).eq('type', 'delta_corrected').order('created_at', { ascending: true }),
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
      setCorrections(
        ((correctionsRes.data ?? []) as MissionEventRow[])
          .map(rowToCorrection)
          .filter((c): c is DeltaCorrection => c !== null),
      )

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
      }
    },
    [user],
  )

  const handleAcceptDelta = useCallback(
    async (delta: Delta): Promise<boolean> => {
      if (delta.missionId) {
        const ok = await recordDeltaEvent('delta_accepted', delta.missionId, delta.move)
        if (!ok) return false
      }
      setAcceptedMove(delta.move)
      return true
    },
    [recordDeltaEvent],
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
      setAcceptedMove(null)
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

  async function handleNewMission() {
    if (!user || !newTitle.trim()) return
    const id = newId()
    const result = captureIdea(board, { id, title: newTitle, why: newWhy, now: new Date().toISOString() })
    if (result.error) {
      setError(result.error)
      return
    }
    setBoard(result.board)
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
    }
  }

  function handleCaptureIdea() {
    const text = captureText.trim()
    if (!text || !user) return
    capture.capture(text)
    setCaptureText('')
    flash('Captured — Parked in your inbox')
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

      {/* The predictive front door: resolves from real state before the
          user types anything, and renders during the load so its reasoning
          state reflects work that is actually pending. */}
      <StrategicDelta
        missions={Object.values(board.missions)}
        evidence={evidence}
        corrections={corrections}
        phase={deltaPhase}
        acceptedMove={acceptedMove}
        readAvailable={loaded && !loadFailed}
        persistError={deltaError}
        onAccept={handleAcceptDelta}
        onCorrect={handleCorrectDelta}
        onContextAdded={handleDeltaContext}
        onRecheck={handleDeltaRecheck}
        requestOperation={operationStageConfigured ? handleRequestOperation : undefined}
      >
        {loaded && missionList.length === 0 ? (
          <form
            className="mission-invite"
            onSubmit={event => {
              event.preventDefault()
              void handleNameOutcome()
            }}
          >
            <div className="mission-invite-field">
              <label htmlFor="mission-outcome">The outcome that matters most</label>
              <Input
                id="mission-outcome"
                name="outcome"
                className="mission-invite-input"
                autoComplete="off"
                enterKeyHint="next"
                required
                placeholder="A real human outcome"
                value={nameTitle}
                onChange={setNameTitle}
              />
            </div>
            <div className="mission-invite-field">
              <label htmlFor="mission-finish">The finish line that ends it</label>
              <Input
                id="mission-finish"
                name="finish_line"
                className="mission-invite-input"
                autoComplete="off"
                enterKeyHint="done"
                required
                placeholder="The observable condition that makes it complete"
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
      {loaded && user && !loadFailed && primary && (
        <SavedActions key={primary.id} missionId={primary.id} />
      )}

      {!loaded ? (
        <p className="mission-status">Loading missions…</p>
      ) : (
        <>
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
