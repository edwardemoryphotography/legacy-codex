'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DeltaCorrection, EvidenceRecord, Mission, StrategicDelta as Delta } from '@/types'
import { predictStrategicDelta } from '@/lib/strategicDelta'
import { ActionBtn, ActionChip, Badge, Textarea } from '@/components/ui'

// Phases are derived from work that is actually pending — anonymous
// sign-in, then the missions/evidence read. Nothing here runs on a timer
// to look busy; when the read is fast, the Delta simply resolves fast.
export type DeltaPhase = 'orienting' | 'reading' | 'resolved'

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
  no_finish_line: 'No finish line',
  displaces_primary: 'Needs a priority challenge',
  lower_leverage: 'Lower leverage',
}

type OpenPanel = 'why' | 'correct' | 'changed' | null

interface Props {
  missions: Mission[]
  evidence: EvidenceRecord[]
  corrections: DeltaCorrection[]
  phase: DeltaPhase
  /** The move the user has accepted, if any. Compared by value so a
   *  re-prediction that changes the move clears the accepted state. */
  acceptedMove: string | null
  onAccept: (delta: Delta) => void
  onCorrect: (delta: Delta, reason: string) => void
  onContextAdded: (delta: Delta, note: string) => void
  onRecheck: () => void
}

export default function StrategicDelta({
  missions,
  evidence,
  corrections,
  phase,
  acceptedMove,
  onAccept,
  onCorrect,
  onContextAdded,
  onRecheck,
}: Props) {
  // Set after mount so server and client never disagree about the clock.
  const [now, setNow] = useState<string | null>(null)
  const [showPhaseText, setShowPhaseText] = useState(false)
  const [open, setOpen] = useState<OpenPanel>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [changedNote, setChangedNote] = useState('')

  useEffect(() => {
    setNow(new Date().toISOString())
  }, [])

  const reasoning = phase !== 'resolved' || now === null

  // A sub-150ms read should not flash a reasoning state at the user; a
  // real one always exceeds this.
  useEffect(() => {
    if (!reasoning) {
      setShowPhaseText(false)
      return
    }
    const timer = setTimeout(() => setShowPhaseText(true), 140)
    return () => clearTimeout(timer)
  }, [reasoning])

  const delta = useMemo(
    () => (now === null ? null : predictStrategicDelta(missions, evidence, corrections, now)),
    [missions, evidence, corrections, now],
  )

  function recheck() {
    setNow(new Date().toISOString())
    onRecheck()
  }

  function submitCorrection() {
    if (!delta || !correctionReason.trim()) return
    onCorrect(delta, correctionReason.trim())
    setCorrectionReason('')
    setOpen(null)
    setNow(new Date().toISOString())
  }

  function submitChanged() {
    if (!delta || !changedNote.trim()) return
    onContextAdded(delta, changedNote.trim())
    setChangedNote('')
    setOpen(null)
    recheck()
  }

  // A correction is recorded against the mission the Delta names. An
  // insufficient-context Delta names no mission, so there is nothing to
  // correct yet — say that rather than offering a control that fails.
  const canCorrect = Boolean(delta?.missionId)
  const accepted = delta !== null && acceptedMove === delta.move

  return (
    <section
      className="sd"
      data-state={reasoning ? 'reasoning' : 'resolved'}
      data-provenance={delta?.provenance ?? 'deterministic'}
      aria-live="polite"
      aria-busy={reasoning}
      aria-label="Strategic Delta"
    >
      <div className="sd-halo" aria-hidden="true" />

      <p className="sd-eyebrow">
        <span aria-hidden="true">◇</span>
        {reasoning ? 'Strategic Delta' : 'Your Strategic Delta'}
      </p>

      {reasoning ? (
        <p className="sd-phase">
          {showPhaseText ? PHASE_TEXT[phase === 'resolved' ? 'reading' : phase] : ' '}
        </p>
      ) : delta ? (
        <>
          <p className="sd-move">{delta.move}</p>

          <p className="sd-because">{delta.because}</p>

          <div className="sd-controls">
            {delta.provenance === 'insufficient_context' ? null : accepted ? (
              <Badge tone="success">Accepted — still a prediction until there&apos;s evidence</Badge>
            ) : (
              <ActionBtn onClick={() => onAccept(delta)}>Do this</ActionBtn>
            )}
            <ActionChip
              onClick={() => setOpen(open === 'why' ? null : 'why')}
              variant={open === 'why' ? 'primary' : 'secondary'}
            >
              Why?
            </ActionChip>
            <ActionChip
              disabled={!canCorrect}
              onClick={() => setOpen(open === 'correct' ? null : 'correct')}
              variant={open === 'correct' ? 'primary' : 'secondary'}
            >
              Not right
            </ActionChip>
            <ActionChip
              onClick={() => setOpen(open === 'changed' ? null : 'changed')}
              variant={open === 'changed' ? 'primary' : 'secondary'}
            >
              Something changed
            </ActionChip>
          </div>

          <div className="sd-provenance">
            <span>{PROVENANCE_LABEL[delta.provenance]}</span>
            <span aria-hidden="true">·</span>
            <span>Read {delta.assembledFrom.join(', ')}</span>
          </div>

          {open === 'why' && (
            <div className="sd-why">
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
            </div>
          )}

          {open === 'correct' && (
            <div className="sd-why">
              <h3>What&apos;s wrong with it?</h3>
              <label htmlFor="sd-correction" className="sr-only">
                Why this move isn&apos;t right
              </label>
              <Textarea
                id="sd-correction"
                rows={3}
                value={correctionReason}
                onChange={setCorrectionReason}
                placeholder="Vaughn isn't available this week. Beau is."
              />
              <div className="sd-controls">
                <ActionBtn disabled={!correctionReason.trim()} onClick={submitCorrection}>
                  Record and re-predict
                </ActionBtn>
                <ActionChip variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </ActionChip>
              </div>
              <p style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                This move stops being recommended and stays in your history as a correction. The
                previous prediction is kept, not erased.
              </p>
            </div>
          )}

          {open === 'changed' && (
            <div className="sd-why">
              <h3>What changed?</h3>
              <label htmlFor="sd-changed" className="sr-only">
                What changed
              </label>
              <Textarea
                id="sd-changed"
                rows={3}
                value={changedNote}
                onChange={setChangedNote}
                placeholder="The staging deploy finished."
              />
              <div className="sd-controls">
                <ActionBtn disabled={!changedNote.trim()} onClick={submitChanged}>
                  Record and recheck
                </ActionBtn>
                <ActionChip variant="ghost" onClick={recheck}>
                  Just recheck
                </ActionChip>
                <ActionChip variant="ghost" onClick={() => setOpen(null)}>
                  Cancel
                </ActionChip>
              </div>
              <p style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: '0.78rem', lineHeight: 1.5 }}>
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
