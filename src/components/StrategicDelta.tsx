'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DeltaCandidate, DeltaCorrection, EvidenceRecord, Mission, StrategicDelta as Delta } from '@/types'
import { candidateTargetsClause, operationCandidateId, predictStrategicDelta } from '@/lib/strategicDelta'
import { ActionBtn, ActionChip, Textarea } from '@/components/ui'
import { OrbSlot, useOrbCognition } from '@/components/OrbHost'

// Phases are derived from work that is actually pending — anonymous
// sign-in, then the missions/evidence read. Nothing here runs on a timer
// to look busy; when the read is fast, the Delta simply resolves fast.
export type DeltaPhase = 'orienting' | 'reading' | 'resolved'

export type DeltaWrite = (delta: Delta) => void | boolean | Promise<void | boolean>
export type DeltaCorrect = (delta: Delta, reason: string) => void | boolean | Promise<void | boolean>
export type DeltaContextWrite = (delta: Delta, note: string) => void | boolean | Promise<void | boolean>
export type DeltaSupplyStep = (delta: Delta, step: string) => void | boolean | Promise<void | boolean>

// The narrowly bounded model-assist request: one clause in, one operation
// (or nothing) out. The caller (MissionTab) owns auth and the actual fetch
// to /api/delta-operation — this component only ever sees the result, and
// only ever feeds it into the same pipeline every deterministic candidate
// runs through. Omitting this prop is exactly as honest as it returning
// null every time: no model stage, no fake capability.
export interface DeltaOperationRequest {
  missionId: string
  missionTitle: string
  finishLine: string
  clause: string
  rejectedOperations: Array<{ operation: string; reason: string }>
}
export type DeltaRequestOperation = (req: DeltaOperationRequest) => Promise<string | null>

const PHASE_TEXT: Record<Exclude<DeltaPhase, 'resolved'>, string> = {
  orienting: 'Reconstructing where you left off…',
  reading: 'Checking what changed…',
}

const PROVENANCE_LABEL: Record<Delta['provenance'], string> = {
  deterministic: 'Predicted from your mission state',
  model: 'Model-generated — not verified',
  supplied: 'You supplied this step — not verified',
  insufficient_context: 'Not enough state to predict from',
}

const INHIBITION_LABEL: Record<string, string> = {
  corrected: 'You corrected this',
  unverified_state: 'Unverified state',
  blocked: 'Blocked',
  capacity_mismatch: 'Reported as not fitting capacity',
  no_finish_line: 'No finish line',
  displaces_primary: 'Needs a priority challenge',
  lower_leverage: 'Lower leverage',
  not_a_move: 'Restates the mission, not a move',
}

const NO_ACCEPTANCES: Readonly<Record<string, string>> = {}
const NO_SUPPLIED_STEPS: DeltaCandidate[] = []

type OpenPanel = 'why' | 'correct' | 'changed' | null
type Cognition = 'reconstructing' | 'correcting' | 'deriving' | 'insufficient' | 'settled' | 'accepted' | 'failed'

function eyebrowFor(cognition: Cognition, reasoning: boolean, firstRun: boolean): string {
  if (cognition === 'failed') return 'This did not record'
  if (cognition === 'correcting') return 'Reconsidering'
  if (cognition === 'deriving') return 'Working out the step'
  if (reasoning) return 'Reconstructing'
  if (firstRun) return 'Bring one idea'
  if (cognition === 'insufficient') return 'Not enough yet'
  if (cognition === 'accepted') return 'Intending this next'
  return 'Recommendation'
}

function displayTitle(delta: Delta, isFirstRun: boolean, readAvailable: boolean): string {
  if (delta.provenance !== 'insufficient_context') return delta.move
  if (!delta.missionId) {
    if (!readAvailable) return 'Not enough to predict'
    return isFirstRun ? 'Name what matters' : 'Not enough to predict'
  }
  if (delta.blockingGap?.startsWith('No concrete operation')) return 'Needs a concrete step'
  if (delta.blockingGap === 'No part of the finish line is smaller than the finish line.') return 'Needs a smaller step'
  if (delta.blockingGap === 'The only candidate this mission had was corrected.') return 'Needs another angle'
  return 'Not enough to predict'
}

interface Props {
  missions: Mission[]
  evidence: EvidenceRecord[]
  corrections: DeltaCorrection[]
  phase: DeltaPhase
  /** mission id → the move accepted for it, rehydrated from delta_accepted.
   *  Compared by value against the Delta on screen, so a re-prediction that
   *  changes the move — or aims at another mission — is not shown accepted. */
  acceptedMoves?: Readonly<Record<string, string>>
  /** Whether the caller's mission/correction read has actually succeeded
   *  at least once. `missions: []` is ambiguous on its own — it means
   *  either a confirmed-empty first-time visitor or a failed read that
   *  defaulted to empty, and only the caller knows which. First-run copy
   *  must never show for the latter (AGENTS.md: "Failed evidence reads
   *  are not empty evidence"). */
  readAvailable: boolean
  /** Persistence failure for a Delta write. Distinct from a successful
   *  recording — the UI must never look saved when the write was rejected. */
  persistError?: string | null
  onAccept: DeltaWrite
  onCorrect: DeltaCorrect
  /** Persist a step the user wrote for the unresolved clause, then let the
   *  engine evaluate it. This is not a correction of the fallback sentence. */
  onSupplyStep: DeltaSupplyStep
  /** Steps already on record, including ones restored after reload. */
  suppliedOperations?: DeltaCandidate[]
  onContextAdded: DeltaContextWrite
  onRecheck: () => void
  /** The narrowly bounded model-assist stage. Called at most once per
   *  clause per mount, only when the deterministic engine has genuinely
   *  exhausted structural signal for it. Omit to run deterministic-only —
   *  that is a fully honest configuration, not a degraded one. */
  requestOperation?: DeltaRequestOperation
  /** Missing-input controls for insufficient context. Rendered inside the
   *  hero, not below it — and never inside the live region. */
  children?: ReactNode
}

export default function StrategicDelta({
  missions,
  evidence,
  corrections,
  phase,
  acceptedMoves = NO_ACCEPTANCES,
  readAvailable,
  persistError = null,
  onAccept,
  onCorrect,
  onSupplyStep,
  suppliedOperations = NO_SUPPLIED_STEPS,
  onContextAdded,
  onRecheck,
  requestOperation,
  children,
}: Props) {
  // Set after mount so server and client never disagree about the clock.
  const [now, setNow] = useState<string | null>(null)
  const [showPhaseText, setShowPhaseText] = useState(false)
  const [open, setOpen] = useState<OpenPanel>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [changedNote, setChangedNote] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const [recording, setRecording] = useState(false)
  // Model-derived operations, keyed by the clause id they target. Never
  // fabricated here — only ever what `requestOperation` handed back, run
  // through the exact same engine every deterministic candidate goes
  // through (see `delta` below).
  const [modelSuggestions, setModelSuggestions] = useState<Record<string, DeltaCandidate>>({})
  const [awaitingOperation, setAwaitingOperation] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const attemptedOperationStates = useRef<Set<string>>(new Set())
  const whyRef = useRef<HTMLDivElement>(null)
  const correctionRef = useRef<HTMLTextAreaElement>(null)
  const changedRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setNow(new Date().toISOString())
  }, [])

  const pendingRead = phase !== 'resolved' || now === null
  const reconstructing = pendingRead || correcting || awaitingOperation

  // A sub-150ms read should not flash a reasoning state at the user; a
  // real one always exceeds this.
  useEffect(() => {
    if (!reconstructing) {
      setShowPhaseText(false)
      return
    }
    const timer = setTimeout(() => setShowPhaseText(true), 140)
    return () => clearTimeout(timer)
  }, [reconstructing])

  // The deterministic-only pass. Never rendered directly — it exists only
  // to ask the engine, honestly, whether a clause is stuck for lack of a
  // structural operation. `delta`, below, is what's actually shown, and
  // includes any model suggestion gathered so far.
  const baseDelta = useMemo(
    () => (now === null ? null : predictStrategicDelta(missions, evidence, corrections, now, suppliedOperations)),
    [missions, evidence, corrections, now, suppliedOperations],
  )

  const suggestedOperations = useMemo(
    () => [...suppliedOperations, ...Object.values(modelSuggestions)],
    [modelSuggestions, suppliedOperations],
  )

  const delta = useMemo(
    () => (now === null ? null : predictStrategicDelta(missions, evidence, corrections, now, suggestedOperations)),
    [missions, evidence, corrections, now, suggestedOperations],
  )

  // Fires at most once for each target/rejection state: only when the deterministic pass has
  // genuinely exhausted structural signal for a specific, known clause of
  // a known mission. Never invoked for the true no-mission-at-all state
  // (baseDelta.missionId is null there), and never retried once attempted
  // — a failed or empty result stays the honest fallback until the human adds
  // a correction that gives the model a new constraint for the same target.
  useEffect(() => {
    if (!requestOperation || !baseDelta) return
    if (baseDelta.provenance !== 'insufficient_context') return
    const targetId = baseDelta.candidateId
    if (!targetId || !targetId.startsWith('clause:') || !baseDelta.missionId) return

    const targetCorrections = corrections.filter(c => candidateTargetsClause(c.candidateId, targetId))
    const attemptKey = `${targetId}:${targetCorrections.map(c => c.id).join(',')}`
    if (attemptedOperationStates.current.has(attemptKey)) return

    const mission = missions.find(m => m.id === baseDelta.missionId)
    const clause = baseDelta.proofSteps.find(s => s.selected)?.text
    if (!mission?.finishLine || !clause) return

    attemptedOperationStates.current.add(attemptKey)
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setOperationError(null)
    })
    setAwaitingOperation(true)

    const rejectedOperations = corrections
      .filter(c => c.missionId === mission.id && (!c.candidateId || candidateTargetsClause(c.candidateId, targetId)))
      .map(c => ({ operation: c.correctedMove, reason: c.reason }))
      .filter(c => c.operation && c.reason)

    requestOperation({
      missionId: mission.id,
      missionTitle: mission.title,
      finishLine: mission.finishLine,
      clause,
      rejectedOperations,
    })
      .then(operation => {
        if (cancelled) return
        if (operation) {
          setModelSuggestions(prev => ({
            ...prev,
            [operationCandidateId(targetId, operation)]: {
              id: operationCandidateId(targetId, operation),
              kind: 'model_suggested',
              move: operation,
              missionId: mission.id,
              targetId,
              rank: 0,
            },
          }))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOperationError('Model-assisted operation generation failed. The honest fallback remains.')
        }
      })
      .finally(() => {
        if (!cancelled) setAwaitingOperation(false)
      })

    return () => {
      cancelled = true
    }
  }, [requestOperation, baseDelta, missions, corrections])

  useEffect(() => {
    const node =
      open === 'why' ? whyRef.current
        : open === 'correct' ? correctionRef.current
          : open === 'changed' ? changedRef.current
            : null
    if (!node) return
    node.focus()
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' })
    }
  }, [open])

  function recheck() {
    setNow(new Date().toISOString())
    onRecheck()
  }

  async function submitCorrection() {
    if (!delta || !correctionReason.trim() || recording) return
    setRecording(true)
    setCorrecting(true)
    setOpen(null)
    const result = await Promise.resolve(onCorrect(delta, correctionReason.trim()))
    setRecording(false)
    if (result === false) {
      setCorrecting(false)
      setOpen('correct')
      return
    }
    setCorrectionReason('')
    setNow(new Date().toISOString())
    setCorrecting(false)
  }

  async function submitSuppliedStep() {
    if (!delta || !correctionReason.trim() || recording) return
    setRecording(true)
    const result = await Promise.resolve(onSupplyStep(delta, correctionReason.trim()))
    setRecording(false)
    if (result === false) {
      setOpen('correct')
      return
    }
    setOpen(null)
    setCorrectionReason('')
    setNow(new Date().toISOString())
  }

  async function submitChanged() {
    if (!delta || !changedNote.trim() || recording) return
    setRecording(true)
    const result = await Promise.resolve(onContextAdded(delta, changedNote.trim()))
    setRecording(false)
    if (result === false) return
    setChangedNote('')
    setOpen(null)
    recheck()
  }

  async function accept() {
    if (!delta || recording) return
    setRecording(true)
    const result = await Promise.resolve(onAccept(delta))
    setRecording(false)
    if (result === false) return
  }

  // A correction is recorded against the mission the Delta names. An
  // insufficient-context Delta names no mission, so there is nothing to
  // correct yet — say that rather than offering a control that fails.
  const canCorrect = Boolean(delta?.missionId)
  const accepted = delta?.missionId != null && acceptedMoves[delta.missionId] === delta.move
  const latestCorrection = corrections[corrections.length - 1] ?? null
  // The true first-run state: no mission has ever existed yet, so this is
  // the actual new-visitor entry surface (a stuck clause on an existing
  // mission is also insufficient_context, but that's a returning user who
  // already knows the product). Presentation-only — the underlying delta
  // and its `because`/provenance fields are untouched for tests and for
  // returning users; only what's displayed for a first-time visitor changes.
  // Gated on readAvailable: an empty `missions` array from a failed read
  // looks identical to a confirmed-empty one, and a failed read must never
  // be presented as "you're a new visitor" reassurance. Also gated on
  // missions.length === 0: a returning user whose missions are all
  // completed/paused/abandoned also gets missionId: null (the engine finds
  // no candidates to generate from), but they are not a new visitor —
  // `missions` itself, not just the derived delta, is the source of truth
  // for "has this account ever had a mission".
  const isFirstRun = delta?.provenance === 'insufficient_context' && !delta?.missionId && readAvailable && missions.length === 0

  const cognition: Cognition = persistError || operationError
    ? 'failed'
    : correcting
      ? 'correcting'
      : pendingRead
        ? 'reconstructing'
        : awaitingOperation
          ? 'deriving'
          : delta?.provenance === 'insufficient_context'
            ? 'insufficient'
            : accepted
              ? 'accepted'
              : 'settled'

  const phaseCopy = correcting
    ? 'Reconsidering from what you just taught it…'
    : awaitingOperation
      ? 'Working out the concrete step…'
      : PHASE_TEXT[phase === 'resolved' ? 'reading' : phase]

  const primaryMission = missions.find(mission => mission.state === 'primary') ?? null
  const hasRecommendation = delta !== null && delta.provenance !== 'insufficient_context'
  const needsStep = delta?.provenance === 'insufficient_context' && Boolean(delta.missionId)
  const needsRead = delta?.provenance === 'insufficient_context' && !delta.missionId && !readAvailable
  const title = delta ? displayTitle(delta, isFirstRun, readAvailable) : null
  const aimedMission = delta?.missionId ? missions.find(mission => mission.id === delta.missionId) ?? null : null
  const finishLine = aimedMission?.finishLine ?? null
  const proofSteps = delta?.proofSteps ?? []
  const retainedStep = delta?.inhibited.find(candidate =>
    candidate.kind === 'supplied_operation' && candidate.move !== delta.move,
  ) ?? null
  const provenance = delta?.provenance ?? 'deterministic'
  useOrbCognition({ cognition, provenance, recording })

  return (
    <section
      className="sd"
      data-state={reconstructing ? 'reasoning' : 'resolved'}
      data-cognition={cognition}
      data-provenance={provenance}
      data-recording={recording ? 'true' : undefined}
      data-first-run={isFirstRun ? 'true' : undefined}
      aria-busy={reconstructing || recording}
      aria-label="Strategic Delta"
    >
      <div className="sd-stage">
      <OrbSlot />
      <div className="sd-copy">
      <header className="sd-identity">
        <h2>Strategic Delta</h2>
        <p className="sd-purpose">Your best next move</p>
      </header>
      {!pendingRead && (
        <p className="sd-mission">
          {primaryMission ? (
            <>Primary mission <strong>{primaryMission.title}</strong></>
          ) : readAvailable ? (
            'No Primary mission yet'
          ) : (
            'Primary mission unavailable'
          )}
        </p>
      )}
      <p className="sd-status">{eyebrowFor(cognition, pendingRead, isFirstRun)}</p>

      {pendingRead ? (
        <p className="sd-phase" aria-live="polite">
          {showPhaseText ? phaseCopy : '\u00a0'}
        </p>
      ) : delta && title ? (
        <>
          <p className="sd-move" key={hasRecommendation ? delta.move : title} aria-live={hasRecommendation ? 'polite' : undefined}>{title}</p>
          {retainedStep && !hasRecommendation && (
            <p className="sd-taught">Kept: {retainedStep.move}. It stays on record, and it is not the next step.</p>
          )}

          <div className="sd-act">
            {hasRecommendation && accepted ? (
              <div className="sd-act-primary">
                {/* The saved action is a separate, explicit commitment. This
                    only points at it; nothing is saved from here. */}
                {primaryMission && delta.missionId === primaryMission.id && (
                  <a className="sd-next" href="#saved-action">Save it as one action you can return to</a>
                )}
                <p className="sd-accepted">
                  Accepted — still a prediction until there&apos;s evidence
                </p>
              </div>
            ) : hasRecommendation && !accepted ? (
              <div className="sd-act-primary">
                <ActionBtn onClick={() => void accept()}>Accept this move</ActionBtn>
                <p className="sd-boundary">
                  Accepting records the recommendation. It does not save an action, and it does not prove the work is done.
                </p>
              </div>
            ) : needsStep ? (
              <div className="sd-act-primary">
                <ActionBtn onClick={() => setOpen(open === 'correct' ? null : 'correct')} aria-expanded={open === 'correct'} aria-controls="sd-correct">
                  Name the concrete step
                </ActionBtn>
                <p className="sd-boundary">
                  If this step names something to do, it becomes the next move. It does not save an action, and it is not verified evidence.
                </p>
              </div>
            ) : needsRead ? (
              <div className="sd-act-primary">
                <ActionBtn onClick={recheck}>Check again</ActionBtn>
                <p className="sd-boundary">
                  The mission read did not succeed, so there is nothing honest to predict from yet.
                </p>
              </div>
            ) : null}
            <div className="sd-act-secondary">
              <ActionChip
                onClick={() => setOpen(open === 'why' ? null : 'why')}
                variant="ghost"
                aria-expanded={open === 'why'}
                aria-controls="sd-why"
              >
                Why this?
              </ActionChip>
              {hasRecommendation && canCorrect && (
                <ActionChip
                  onClick={() => setOpen(open === 'correct' ? null : 'correct')}
                  variant="secondary"
                  aria-expanded={open === 'correct'}
                  aria-controls="sd-correct"
                >
                  Correct this
                </ActionChip>
              )}
              {canCorrect && (
                <ActionChip
                  onClick={() => setOpen(open === 'changed' ? null : 'changed')}
                  variant="ghost"
                  aria-expanded={open === 'changed'}
                  aria-controls="sd-changed"
                  className="sd-act-changed"
                >
                  Something changed
                </ActionChip>
              )}
            </div>
          </div>

          {!hasRecommendation && delta.move !== title && (
            <p className="sd-because" aria-live="polite">{delta.move}</p>
          )}
          {(isFirstRun || delta.because !== delta.move) && (
            <p className={hasRecommendation || delta.move === title ? 'sd-because' : 'sd-support'}>
              {isFirstRun
                ? 'Write the idea below. The next move is named from those words, and from nothing else.'
                : delta.because}
            </p>
          )}

          {/* Missing-input controls belong only to the true no-mission
              state. A clause the engine can't derive an operation for is
              also insufficient_context, but a real mission and finish line
              already exist there — re-showing the "name your mission" form
              would be wrong. */}
          {delta.provenance === 'insufficient_context' && !delta.missionId && children}

          {(correcting || awaitingOperation) && (
            <p className="sd-phase">{showPhaseText ? phaseCopy : '\u00a0'}</p>
          )}

          {latestCorrection && (
            <p className="sd-taught">
              You taught it: {latestCorrection.reason}
            </p>
          )}

          {persistError && (
            <p className="sd-fail" role="alert">
              {persistError}
            </p>
          )}

          {operationError && (
            <p className="sd-fail" role="alert">
              {operationError}
            </p>
          )}

          <p className="sd-provenance">
            {isFirstRun ? "This is your own space — nothing here is shared." : PROVENANCE_LABEL[delta.provenance]}
          </p>

          {open === 'why' && (
            <div
              id="sd-why"
              className="sd-why"
              ref={whyRef}
              tabIndex={-1}
              role="region"
              aria-label={hasRecommendation ? 'Why this is the move' : 'Why no recommendation was chosen'}
            >
              <p className="sd-why-lead">
                {hasRecommendation
                  ? 'The move above is the recommendation. This is why it was chosen.'
                  : 'No recommendation was chosen. This is the state the prediction stopped in, and what it was missing.'}
              </p>
              {delta.missionTitle && (
                <section>
                  <h3>Mission</h3>
                  <p>{delta.missionTitle}</p>
                </section>
              )}
              <section>
                <h3>Current reality</h3>
                <p>{delta.currentReality}</p>
              </section>
              {(finishLine || delta.proofSteps.length > 0) && (
                <section>
                  <h3>What your finish line asks you to prove</h3>
                  {finishLine && <p className="sd-finish">{finishLine}</p>}
                  {proofSteps.length > 0 && (
                    <ol className="sd-steps">
                      {proofSteps.map(step => (
                        <li
                          key={step.index}
                          data-selected={step.selected || undefined}
                          data-rejected={step.rejectedOperations > 0 || undefined}
                        >
                          {step.text}
                          {step.selected && <span className="sd-step-tag">aiming here</span>}
                          {step.rejectedOperations > 0 && (
                            <span className="sd-step-tag">
                              {step.rejectedOperations} rejected move{step.rejectedOperations === 1 ? '' : 's'}; still unresolved
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  {proofSteps.length === 0 && finishLine && (
                    <p>The finish line does not separate into independent requirements.</p>
                  )}
                </section>
              )}
              {delta.blockingGap && (
                <section>
                  <h3>Blocking gap</h3>
                  <p>{delta.blockingGap}</p>
                </section>
              )}
              <section>
                <h3>Evidence</h3>
                <p>
                  {delta.evidenceState === 'none'
                    ? 'No evidence is linked to this mission, so nothing here is verified.'
                    : `Evidence on this mission is ${delta.evidenceState}.`}
                </p>
              </section>
              <section>
                <h3>Saved commitment</h3>
                <p>
                  A saved action and its starting-point note are a commitment you recorded. Strategic Delta does not read them. It predicts from the mission, the finish line, linked evidence, and corrections. The note is your report of where you stopped. It is not verified evidence, and it does not become this recommendation.
                </p>
              </section>
              {delta.inhibited.length > 0 && (
                <section>
                  <h3>Alternatives inhibited</h3>
                  <ul className="sd-trace">
                    {delta.inhibited.map(candidate => (
                      <li key={candidate.id}>
                        <div className="sd-trace-move">{candidate.move}</div>
                        <div className="sd-trace-why">
                          {INHIBITION_LABEL[candidate.reason] ?? candidate.reason} — {candidate.explanation}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3>What would change this</h3>
                <p>{delta.wouldChangeIf}</p>
              </section>
              <p className="sd-assembled">Read {delta.assembledFrom.join(', ')}</p>
            </div>
          )}

          {open === 'correct' && (
            <div id="sd-correct" className="sd-why sd-teach">
              {needsStep ? (
                <>
                  <h3>What is the concrete step?</h3>
                  <label htmlFor="sd-correction" className="sr-only">
                    The concrete step this mission needs
                  </label>
                </>
              ) : (
                <>
                  <p className="sd-teach-target">
                    <span>Teaching it about</span>
                    {delta.move}
                  </p>
                  <h3>What&apos;s off about this?</h3>
                  <label htmlFor="sd-correction" className="sr-only">
                    Why this move isn&apos;t right
                  </label>
                </>
              )}
              <Textarea
                id="sd-correction"
                rows={3}
                compact
                value={correctionReason}
                onChange={setCorrectionReason}
                placeholder={needsStep ? 'The one action that would move this forward.' : "Vaughn isn't available this week. Beau is."}
                textareaRef={correctionRef}
              />
              <div className="sd-controls">
                <ActionBtn disabled={!correctionReason.trim() || recording} onClick={() => void (needsStep ? submitSuppliedStep() : submitCorrection())}>
                  {needsStep ? 'Record this step' : 'Teach it this'}
                </ActionBtn>
                <ActionChip variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </ActionChip>
              </div>
              <p className="sd-hint">
                {needsStep
                  ? 'This keeps the step and evaluates it for this unresolved part. It does not save an action, and it is not verified evidence. A step that only restates the destination stays on record and is not offered as the next move.'
                  : 'This move stops being recommended and stays in your history as a correction. The previous prediction is kept, not erased.'}
              </p>
            </div>
          )}

          {open === 'changed' && (
            <div id="sd-changed" className="sd-why">
              <h3>What changed?</h3>
              <label htmlFor="sd-changed-note" className="sr-only">
                What changed
              </label>
              <Textarea
                id="sd-changed-note"
                rows={3}
                compact
                value={changedNote}
                onChange={setChangedNote}
                placeholder="The staging deploy finished."
                textareaRef={changedRef}
              />
              <div className="sd-controls">
                <ActionBtn disabled={!changedNote.trim() || recording} onClick={() => void submitChanged()}>
                  Record and recheck
                </ActionBtn>
                <ActionChip variant="ghost" onClick={recheck}>
                  Just recheck
                </ActionChip>
                <ActionChip variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </ActionChip>
              </div>
              <p className="sd-hint">
                Legacy Codex predicts from mission state, so a note alone won&apos;t move the
                prediction — it goes in the ledger. To change what it predicts, change what it
                reads: set or clear a blocker, set a finish line, or change what&apos;s Primary.
              </p>
            </div>
          )}
        </>
      ) : null}
      </div>
      </div>
    </section>
  )
}
