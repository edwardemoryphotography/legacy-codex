'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { casebookEvidenceLayers, EVIDENCE_LAYER_LABELS, type EvidenceLayer, type CandidateState } from '@/lib/incidentCandidates'
import type { HistoricalLessonCandidate } from '@/lib/historicalLessonCandidates'
import type { Mission } from '@/types'

// One historical record at a time. The casebook is a source INDEX, not
// account-confirmed learning or evidence of transfer into another real task.
export default function HistoricalLessonReview({ candidate, missions, onLessonWrite }: {
  candidate: HistoricalLessonCandidate
  missions: Mission[]
  onLessonWrite: () => void
}) {
  const { record } = candidate
  const [state, setState] = useState<CandidateState | null>(null)
  const [readError, setReadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [rule, setRule] = useState(candidate.proposedRule)
  const [whenToApply, setWhenToApply] = useState(candidate.whenToApply)
  const [exceptions, setExceptions] = useState(candidate.exceptions)
  const [selectedMission, setSelectedMission] = useState('')
  const [accountWide, setAccountWide] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [acknowledgeOrigin, setAcknowledgeOrigin] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const missionId = missions.some(mission => mission.id === selectedMission) ? selectedMission : ''
  const prefix = 'casebook-' + record.id
  const layers = casebookEvidenceLayers(record)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) throw new Error('Sign in to your existing account before reviewing the lesson.')
        const res = await fetch('/api/delta-lessons?candidateId=' + encodeURIComponent(candidate.id), {
          headers: { Authorization: 'Bearer ' + session.access_token }, cache: 'no-store',
        })
        if (!res.ok) throw new Error('Your existing lesson decision could not be read.')
        const body = await res.json() as { candidates?: CandidateState[] }
        const found = body.candidates?.find(item => item.id === candidate.id)
        if (!found) throw new Error('No decision state was returned. Nothing was changed.')
        if (!cancelled) { setState(found); setReadError('') }
      } catch (error) {
        if (!cancelled) setReadError(error instanceof Error ? error.message : 'Could not read the decision.')
      }
    })()
    return () => { cancelled = true }
  }, [candidate.id, revision])

  async function send(body: object) {
    setBusy(true)
    setMessage('')
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Reconnect to your existing account. Nothing was saved.')
      const res = await fetch('/api/delta-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify(body),
      })
      const payload = await res.json() as { confirmed?: boolean; rejected?: boolean; retired?: boolean; error?: string }
      if (!res.ok || !(payload.confirmed || payload.rejected || payload.retired)) {
        throw new Error(payload.error || 'Nothing was saved.')
      }
      setState(null)
      setRevision(n => n + 1)
      onLessonWrite()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nothing was saved.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="legacy-relay-receive" data-casebook-id={record.id}>
    <h3>{record.id} · {record.title}</h3>
    <p><strong>Historical classification:</strong> {record.recordStatus} · {record.era}</p>
    <p>This is a historical reconstruction, not a Codex-detected incident or a rule already learned. The suggested conditions and exceptions below are editable review language, not observed historical facts.</p>
    <h3>1 · The structural boomerang</h3>
    <p><strong>Source:</strong> {record.sourceDomain}</p>
    <p><strong>Target:</strong> {record.targetDomain}</p>
    <p><strong>Shared structure:</strong> {record.sharedStructure}</p>
    <p><strong>Reasoning bridge:</strong> {record.reasoningBridge}</p>
    <p><strong>Practical consequence:</strong> {record.practicalConsequence}</p>
    <p><strong>Evidence still required:</strong> {record.evidenceRequired}</p>
    <p><strong>Recorded sources:</strong></p>
    <ul>{record.sources.map((source, index) => <li key={record.id + '-' + index}>
      {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}
      {' — '}{source.access === 'restricted'
        ? 'Restricted origin source; content not republished or verified here'
        : 'Linked documentary source; substantive support not independently re-audited'}
    </li>)}</ul>
    <p><strong>Six evidence layers:</strong></p>
    <ul>{(Object.keys(EVIDENCE_LAYER_LABELS) as EvidenceLayer[]).map(key =>
      <li key={key}>{EVIDENCE_LAYER_LABELS[key]}: {layers[key]}</li>)}</ul>

    <h3>2 · Your review and decision</h3>
    {readError && <p role="alert">{readError}</p>}
    {!state && !readError && <p role="status">Reading your saved lesson decision…</p>}
    {state && state.state !== 'confirmed' && <>
      <label htmlFor={prefix + '-rule'}>Proposed rule — edit before confirming</label>
      <textarea id={prefix + '-rule'} rows={3} maxLength={1000} value={rule} onChange={event => setRule(event.target.value)}/>
      <label htmlFor={prefix + '-when'}>When it applies</label>
      <textarea id={prefix + '-when'} rows={3} maxLength={500} value={whenToApply} onChange={event => setWhenToApply(event.target.value)}/>
      <label htmlFor={prefix + '-exceptions'}>Exceptions and missing evidence</label>
      <textarea id={prefix + '-exceptions'} rows={3} maxLength={800} value={exceptions} onChange={event => setExceptions(event.target.value)}/>
      <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/>
        I reviewed the available references and understand that a historical interpretation is not independently verified future behavior.</label>
      {missions.length === 0 ? <p>Save an actual mission before recording this lesson.</p> : <>
        <p>The original boomerang may predate your current missions. A mission is required for ledger ownership, not proof of where the insight originated.</p>
        <label htmlFor={prefix + '-mission'}>Record against which existing mission?</label>
        <select id={prefix + '-mission'} value={missionId} onChange={event => setSelectedMission(event.target.value)}>
          <option value="">Choose a mission…</option>
          {missions.map(mission => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
        </select>
        <label><input type="checkbox" checked={accountWide} onChange={event => setAccountWide(event.target.checked)}/>
          Use across projects only under these conditions</label>
        <label><input type="checkbox" checked={acknowledgeOrigin} onChange={event => setAcknowledgeOrigin(event.target.checked)}/>
          My selected mission owns the record; it is not necessarily the historical source.</label>
        <button type="button" disabled={busy || !reviewed || !acknowledgeOrigin || !missionId || !rule.trim() || !whenToApply.trim() || !exceptions.trim()}
          onClick={() => void send({ action: 'confirm_casebook', candidateId: candidate.id, missionId, rule,
            whenToApply, exceptions, scope: accountWide ? 'account' : 'mission', historicalReviewed: true })}>
          {busy ? 'Saving…' : 'Confirm and carry forward'}</button>
        {state.state !== 'rejected' && <>
          <label htmlFor={prefix + '-reason'}>Or reject this proposed lesson (optional reason)</label>
          <textarea id={prefix + '-reason'} rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)}/>
          <button type="button" disabled={busy || !missionId} onClick={() => void send({
            action: 'reject_casebook', candidateId: candidate.id, missionId, reason,
          })}>Reject this candidate</button>
        </>}
      </>}
    </>}

    <h3>3 · Outcome and inheritance</h3>
    <p>{state?.state === 'confirmed' ? 'Confirmed by you. Eligible future requests may read this rule with its conditions, exceptions and sources under your selected scope.'
      : state?.state === 'retired' ? 'Retired. The decision history is preserved; this rule is not active.'
      : state?.state === 'rejected' ? 'Rejected. The history remains; this rule is not active.'
      : 'Not confirmed. This history alone cannot change future decisions.'}</p>
    {state?.state === 'confirmed' && state.lessonId && <button type="button" disabled={busy}
      onClick={() => void send({ action: 'retire', lessonId: state.lessonId })}>
      {busy ? 'Retiring…' : 'Stop using this lesson'}</button>}
    <p><strong>Later different-task application:</strong> Unknown; not demonstrated by this record.</p>
    <p><strong>Independent outcome:</strong> Unknown; confirmation alone does not prove inherited capability.</p>
    {message && <p role="alert">{message}</p>}
  </div>
}
