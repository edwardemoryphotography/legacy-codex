'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { useCapture } from '@/hooks/useCapture'
import type { CapacityLevel, ContextAvailability, EvidenceRecord, Mission, MissionState } from '@/types'
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
import ActivityOrb from '@/components/ActivityOrb'
import FocusBeam from '@/components/FocusBeam'
import NextMovePanel from '@/components/NextMovePanel'

// ─── Supabase row <-> domain mapping ────────────────────────────────────
// missionLoop.ts operates on the camelCase Mission/MissionEvent domain
// shapes; the missions/mission_events tables are snake_case. This module is
// the only place that translates between them.

interface MissionRow {
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

interface EvidenceRow {
  id: string
  mission_id: string | null
  source: string
  kind: EvidenceRecord['kind']
  status: EvidenceRecord['status']
  claim: string
  observed_at: string
  fetched_at: string
}

function rowToMission(row: MissionRow): Mission {
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

function missionToRow(mission: Mission, userId: string): Omit<MissionRow, 'created_at'> {
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

function rowToEvidence(row: EvidenceRow): EvidenceRecord {
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
  const [loaded, setLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // New-mission form
  const [showNewMission, setShowNewMission] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newWhy, setNewWhy] = useState('')

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

  const loadAll = useCallback(async (userId: string) => {
    setEvidenceStatus('loading')
    try {
      const [missionsRes, evidenceRes] = await Promise.all([
        supabase.from('missions').select('*').eq('user_id', userId),
        supabase.from('evidence_snapshots').select('*'),
      ])
      if (missionsRes.error) throw missionsRes.error

      const missions: Record<string, Mission> = {}
      for (const row of (missionsRes.data ?? []) as MissionRow[]) {
        missions[row.id] = rowToMission(row)
      }
      setBoard({ missions })

      if (!evidenceRes.error) {
        setEvidence(((evidenceRes.data ?? []) as EvidenceRow[]).map(rowToEvidence))
        setEvidenceStatus('ready')
      } else {
        setEvidenceStatus('unavailable')
      }
      setLoaded(true)
    } catch {
      setEvidenceStatus('unavailable')
      setLoadFailed(true)
      setError('Could not load your missions. Reload to reconnect; your saved work has not changed.')
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let current = session?.user ?? null
        if (!current) {
          const { data, error: signInError } = await supabase.auth.signInAnonymously()
          if (signInError) throw signInError
          current = data.user
        }
        if (cancelled || !current) return
        setUser(current)
        setAuthStatus('Signed in')
        await loadAll(current.id)
      } catch {
        if (!cancelled) {
          setEvidenceStatus('unavailable')
          setAuthStatus('Missions unavailable — could not connect to your account.')
          setLoaded(true)
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadAll])

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
          await supabase.from('mission_events').insert({
            id: newId(),
            user_id: user.id,
            mission_id: result.event.missionId,
            type: result.event.type,
            detail: result.event.detail,
            idempotency_key: newId(),
            created_at: result.event.createdAt,
          })
        }
        flash('Saved')
      } catch {
        setBoard(before)
        setError('Write failed — change was not saved. Nothing changed; try again.')
      }
    },
    [board, user, flash],
  )

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
      const { error: insertError } = await supabase.from('missions').insert(missionToRow(result.board.missions[id], user.id))
      if (insertError) throw insertError
      if (result.event) {
        await supabase.from('mission_events').insert({
          id: newId(),
          user_id: user.id,
          mission_id: id,
          type: result.event.type,
          detail: result.event.detail,
          idempotency_key: newId(),
          created_at: result.event.createdAt,
        })
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

  function handleCaptureIdea() {
    const text = captureText.trim()
    if (!text || !user) return
    capture.capture(text)
    setCaptureText('')
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
      <div className="mission-heading">
        <div>
          <h2>What matters now?</h2>
          <p>Make room for the one thing that moves you forward.</p>
        </div>
        <span className="session-status" role="status">
          <span className={user ? 'session-dot connected' : 'session-dot'} aria-hidden="true" />
          {user ? 'Connected' : authStatus}
        </span>
      </div>
      {status && <p className="mission-notice" role="status">{status}</p>}
      {error && <p className="mission-notice" role="alert" style={{ color: 'var(--error)' }}>{error}</p>}

      <FocusBeam active={loaded && !!user && !!primary && !primary.blocker && !loadFailed}>
        <div className="right-now">
          <div className="right-now-heading">
            <ActivityOrb state={loaded ? 'breathing' : 'connecting'} active={!loaded} />
            <div>
              <p className="focus-label">Right now</p>
              {!loaded ? (
                <h3>Connecting to your missions…</h3>
              ) : !user || loadFailed ? (
                <h3>Let’s start with what you know.</h3>
              ) : primary ? (
                <h3>{primary.title}</h3>
              ) : (
                <h3>Give one thing your attention.</h3>
              )}
            </div>
          </div>
          <p className="focus-description">
            {!loaded ? 'Reading your saved context.' : !user || loadFailed
              ? 'Your saved missions are unavailable. You can still use the next-move helper below.'
              : primary?.blocker ? `Blocked: ${primary.blocker}. Review the mission below to unblock it or adjust your priority.`
              : primary ? `Finish line: ${primary.finishLine ?? 'not yet defined'}`
              : 'No Primary mission yet. Capture a mission, define its finish line, then make it your focus.'}
          </p>
          <NextMovePanel embedded context={{
            mission: primary,
            missionStatus: !loaded ? 'loading' : !user || loadFailed ? 'unavailable' : 'ready',
            evidence: primaryEvidence,
            evidenceStatus,
          }} />
        </div>
      </FocusBeam>

      {loaded && user && !loadFailed && (
        <>
          <div className="mission-capture">
            <div>
              <h3>Keep the idea. Keep your focus.</h3>
              <p>Capture it for later without changing your Primary mission.</p>
            </div>
            <label htmlFor="capture-idea" className="sr-only">Capture an idea for later</label>
            <div className="capture-controls">
              <Input id="capture-idea" placeholder="What’s on your mind?" value={captureText} onChange={setCaptureText} />
              <ActionBtn disabled={!captureText.trim()} onClick={handleCaptureIdea}>Capture</ActionBtn>
            </div>
            {capture.status && <p role="status">{capture.status}</p>}
          </div>

          {/* Primary Mission */}
          {primary && <details className="mission-disclosure">
          <summary>Review your Primary mission</summary>
          <Card>
            <SectionTitle>Primary Mission</SectionTitle>
            {primary ? (
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
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                No Primary mission. Promote a Parked mission with a finish line below.
              </div>
            )}
          </Card>

          </details>}

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
