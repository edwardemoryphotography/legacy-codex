'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DeltaCandidate, DeltaCorrection, EvidenceRecord, Mission, StrategicDelta as Delta } from '@/types'
import { candidateTargetsClause, operationCandidateId, predictStrategicDelta } from '@/lib/strategicDelta'
import { ActionBtn, ActionChip, Textarea } from '@/components/ui'
import CognitionField from '@/components/CognitionField'

// Phases are derived from work that is actually pending — anonymous
// sign-in, then the missions/evidence read. Nothing here runs on a timer
// to look busy; when the read is fast, the Delta simply resolves fast.
export type DeltaPhase = 'orienting' | 'reading' | 'resolved'

export type DeltaWrite = (delta: Delta) => void | boolean | Promise<void | boolean>
export type DeltaCorrect = (delta: Delta, reason: string) => void | boolean | Promise<void | boolean>
export type DeltaContextWrite = (delta: Delta, note: string) => void | boolean | Promise<void | boolean>

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

type OpenPanel = 'why' | 'correct' | 'changed' | null
type Cognition = 'reconstructing' | 'correcting' | 'deriving' | 'insufficient' | 'settled' | 'accepted' | 'failed'

function eyebrowFor(cognition: Cognition, reasoning: boolean): string {
  if (cognition === 'failed') return 'This did not record'
  if (cognition === 'correcting') return 'Reconsidering'
  if (cognition === 'deriving') return 'Working out the step'
  if (reasoning) return 'Reconstructing'
  if (cognition === 'insufficient') return 'Not enough yet'
  if (cognition === 'accepted') return 'Intending this next'
  return 'What matters now'
}

interface Props {
  missions: Mission[]
  evidence: EvidenceRecord[]
  corrections: DeltaCorrection[]
  phase: DeltaPhase
  /** The move the user has accepted, if any. Compared by value so a
   *  re-prediction that changes the move clears the accepted state. */
  acceptedMove: string | null
  /** Persistence failure for a Delta write. Distinct from a successful
   *  recording — the UI must never look saved when the write was rejected. */
  persistError?: string | null
  onAccept: DeltaWrite
  onCorrect: DeltaCorrect
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
  acceptedMove,
  persistError = null,
  onAccept,
  onCorrect,
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
    () => (now === null ? null : predictStrategicDelta(missions, evidence, corrections, now, [])),
    [missions, evidence, corrections, now],
  )

  const suggestedOperations = useMemo(() => Object.values(modelSuggestions), [modelSuggestions])

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
  const accepted = delta !== null && acceptedMove === delta.move
  const latestCorrection = corrections[corrections.length - 1] ?? null

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

  return (
    <section
      className="sd"
      data-state={reconstructing ? 'reasoning' : 'resolved'}
      data-cognition={cognition}
      data-provenance={delta?.provenance ?? 'deterministic'}
      aria-busy={reconstructing || recording}
      aria-label="Strategic Delta"
    >
      <CognitionField />

      <p className="sd-eyebrow">{eyebrowFor(cognition, pendingRead)}</p>

      {pendingRead ? (
        <p className="sd-phase" aria-live="polite">
          {showPhaseText ? phaseCopy : '\u00a0'}
        </p>
      ) : delta ? (
        <>
          <p className="sd-move" key={delta.move} aria-live="polite">{delta.move}</p>

          <p className="sd-because">{delta.because}</p>

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

          {accepted && (
            <p className="sd-accepted">
              Accepted — still a prediction until there&apos;s evidence
            </p>
          )}

          <div className="sd-act">
            {delta.provenance === 'insufficient_context' || accepted ? null : (
              <div className="sd-act-primary">
                <ActionBtn onClick={() => void accept()}>Do this</ActionBtn>
              </div>
            )}
            <div className="sd-act-secondary">
              <ActionChip
                onClick={() => setOpen(open === 'why' ? null : 'why')}
                variant={open === 'why' ? 'primary' : 'secondary'}
                aria-expanded={open === 'why'}
                aria-controls="sd-why"
              >
                Why?
              </ActionChip>
              <ActionChip
                disabled={!canCorrect}
                onClick={() => setOpen(open === 'correct' ? null : 'correct')}
                variant={open === 'correct' ? 'primary' : 'secondary'}
                aria-expanded={open === 'correct'}
                aria-controls="sd-correct"
                title={canCorrect ? undefined : 'Nothing to correct until a mission exists'}
              >
                Not right
              </ActionChip>
              <ActionChip
                disabled={!canCorrect}
                onClick={() => setOpen(open === 'changed' ? null : 'changed')}
                variant={open === 'changed' ? 'primary' : 'secondary'}
                aria-expanded={open === 'changed'}
                aria-controls="sd-changed"
                className="sd-act-changed"
                title={canCorrect ? undefined : 'Nothing to attach a note to until a mission exists'}
              >
                Something changed
              </ActionChip>
            </div>
          </div>

          <p className="sd-provenance">
            {PROVENANCE_LABEL[delta.provenance]}
          </p>

          {open === 'why' && (
            <div
              id="sd-why"
              className="sd-why"
              ref={whyRef}
              tabIndex={-1}
              role="region"
              aria-label="Why this is the move"
            >
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
              {delta.proofSteps.length > 0 && (
                <section>
                  <h3>What your finish line asks you to prove</h3>
                  <ol className="sd-steps">
                    {delta.proofSteps.map(step => (
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
              <p className="sd-teach-target">
                <span>Teaching it about</span>
                {delta.move}
              </p>
              <h3>What&apos;s off about this?</h3>
              <label htmlFor="sd-correction" className="sr-only">
                Why this move isn&apos;t right
              </label>
              <Textarea
                id="sd-correction"
                rows={3}
                compact
                value={correctionReason}
                onChange={setCorrectionReason}
                placeholder="Vaughn isn't available this week. Beau is."
                textareaRef={correctionRef}
              />
              <div className="sd-controls">
                <ActionBtn disabled={!correctionReason.trim() || recording} onClick={() => void submitCorrection()}>
                  Teach it this
                </ActionBtn>
                <ActionChip variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </ActionChip>
              </div>
              <p className="sd-hint">
                This move stops being recommended and stays in your history as a correction. The
                previous prediction is kept, not erased.
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
    </section>
  )
}
