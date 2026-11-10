'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { EVIDENCE_LAYER_LABELS, INCIDENT_CANDIDATES, type CandidateState, type EvidenceLayer, type IncidentCandidate } from '@/lib/incidentCandidates'
import type { Mission } from '@/types'

// Real incidents proposed as lessons. Nothing here is a rule until the owner
// confirms it; the candidate text comes from the reviewed repository record.
export default function IncidentLessons({ missions, ready, onLessonWrite }: { missions: Mission[]; ready: boolean; onLessonWrite: () => void }) {
  const [states, setStates] = useState<CandidateState[] | null>(null)
  const [readFailed, setReadFailed] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) throw new Error('Session unavailable.')
        const response = await fetch('/api/delta-lessons', { headers: { Authorization: `Bearer ${session.access_token}` } })
        // Not the owner: a quiet boundary, not a failure.
        if (response.status === 401 || response.status === 403) { if (!cancelled) setStates(null); return }
        const payload = await response.json() as { candidates?: CandidateState[] }
        if (!response.ok || !payload.candidates) throw new Error('Read failed.')
        if (!cancelled) { setStates(payload.candidates); setReadFailed(false) }
      } catch { if (!cancelled) setReadFailed(true) }
    })()
    return () => { cancelled = true }
  }, [ready, revision])

  if (readFailed) return <p role="alert" className="mission-status">Lessons from real incidents could not be loaded. Nothing was changed.</p>
  if (!states) return null
  return <section className="legacy-relay" data-active="true" aria-label="Lessons from real incidents">
    <div className="legacy-relay-heading">
      <p className="legacy-relay-eyebrow">LESSONS FROM REAL INCIDENTS</p>
      <h2>Proposed from what actually happened. Yours to confirm.</h2>
      <p>Each one is reconstructed from linked sources. It changes nothing until you confirm it, and you can correct the words first.</p>
    </div>
    {INCIDENT_CANDIDATES.map(candidate => <Candidate key={candidate.id} candidate={candidate} missions={missions}
      state={states.find(item => item.id === candidate.id) ?? { id: candidate.id, state: 'proposed', lessonId: null, at: null }}
      onWrite={() => { onLessonWrite(); setRevision(value => value + 1) }} />)}
  </section>
}

function Candidate({ candidate, state, missions, onWrite }: { candidate: IncidentCandidate; state: CandidateState; missions: Mission[]; onWrite: () => void }) {
  const [rule, setRule] = useState(candidate.proposedRule)
  const [condition, setCondition] = useState(candidate.whenToApply)
  const [exceptions, setExceptions] = useState(candidate.exceptions)
  const [chosen, setMissionId] = useState('')
  // Missions can arrive after first render; never submit a stale or foreign id.
  const missionId = missions.some(mission => mission.id === chosen) ? chosen : missions.find(mission => mission.state === 'primary')?.id ?? missions[0]?.id ?? ''
  const [acrossProjects, setAcrossProjects] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const when = state.at ? new Date(state.at).toLocaleDateString() : ''
  const prefix = `incident-${candidate.id}`

  async function send(body: object) {
    setBusy(true)
    setMessage('')
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) throw new Error('Reconnect to your account first. Nothing was saved.')
      const response = await fetch('/api/delta-lessons', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
      const payload = await response.json() as { confirmed?: boolean; rejected?: boolean; retired?: boolean; error?: string }
      if (!response.ok || !(payload.confirmed || payload.rejected || payload.retired)) throw new Error(payload.error || 'Nothing was saved.')
      onWrite()
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Nothing was saved.') }
    finally { setBusy(false) }
  }

  return <details className="legacy-relay-receive">
    <summary>{candidate.id} · {candidate.title} — {state.state === 'confirmed' ? `confirmed by you ${when}` : state.state === 'rejected' ? `rejected by you ${when}` : state.state === 'retired' ? 'retired by you' : 'proposed, not confirmed'}</summary>
    <h3>1 · What was observed</h3>
    <p>{candidate.problem}</p>
    <ol>{candidate.attempts.map(attempt => {
      const source = candidate.sources.find(item => item.id === attempt.sourceId)
      return <li key={attempt.sourceId}><a href={source?.url} target="_blank" rel="noreferrer">{source?.label}</a> · {new Date(attempt.observedAt).toLocaleDateString()} — {attempt.approach} <em>Outcome: {attempt.observedOutcome}</em></li>
    })}</ol>
    <p><strong>Proposed mechanism:</strong> {candidate.rootMechanism}</p>
    <p><strong>Where the record disagrees with itself:</strong></p>
    <ul>{candidate.contradictions.map(item => <li key={item}>{item}</li>)}</ul>
    <p><strong>Other explanations:</strong></p>
    <ul>{candidate.competingExplanations.map(item => <li key={item}>{item}</li>)}</ul>
    <p><strong>Evidence, layer by layer:</strong></p>
    <ul>{(Object.keys(EVIDENCE_LAYER_LABELS) as EvidenceLayer[]).map(key => <li key={key}>{EVIDENCE_LAYER_LABELS[key]}: {candidate.layers[key]}</li>)}</ul>

    <h3>2 · Proposed lesson</h3>
    {state.state === 'confirmed' ? <p>Your confirmed words are listed under “Lessons carried forward” after a project review loads.</p> : <>
      <label htmlFor={`${prefix}-rule`}>The rule</label>
      <textarea id={`${prefix}-rule`} value={rule} maxLength={1_000} rows={3} onChange={event => setRule(event.target.value)} />
      <label htmlFor={`${prefix}-when`}>When it applies</label>
      <textarea id={`${prefix}-when`} value={condition} maxLength={500} rows={2} onChange={event => setCondition(event.target.value)} />
      <label htmlFor={`${prefix}-except`}>When it does not apply, or might be wrong</label>
      <textarea id={`${prefix}-except`} value={exceptions} maxLength={800} rows={3} onChange={event => setExceptions(event.target.value)} />
      {missions.length === 0 ? <p>Save a mission first. A confirmed lesson is recorded against one of your missions.</p> : <>
        <label htmlFor={`${prefix}-mission`}>Record it against</label>
        <select id={`${prefix}-mission`} value={missionId} onChange={event => setMissionId(event.target.value)}>
          {missions.map(mission => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
        </select>
        <label><input type="checkbox" checked={acrossProjects} onChange={event => setAcrossProjects(event.target.checked)} /> Use this lesson across my projects under these conditions</label>
        <button type="button" disabled={busy || !missionId || !rule.trim() || !condition.trim() || !exceptions.trim()}
          onClick={() => void send({ action: 'confirm_incident', candidateId: candidate.id, missionId, rule, whenToApply: condition, exceptions, scope: acrossProjects ? 'account' : 'mission' })}>
          {busy ? 'Saving…' : 'Confirm and carry forward'}</button>
        {state.state !== 'rejected' && <>
          <label htmlFor={`${prefix}-reason`}>Or reject it — why is this not a lesson? (optional)</label>
          <textarea id={`${prefix}-reason`} value={reason} maxLength={500} rows={2} onChange={event => setReason(event.target.value)} />
          <button type="button" disabled={busy || !missionId} onClick={() => void send({ action: 'reject_incident', candidateId: candidate.id, missionId, reason })}>This is not a lesson</button>
        </>}
      </>}
    </>}

    <h3>3 · Confirmed rule</h3>
    <p>{state.state === 'confirmed' ? `Confirmed by you on ${when}. Future project reviews, briefs and file analysis read it with its conditions and exceptions.`
      : state.state === 'rejected' ? `Rejected by you on ${when}. The record is kept; no review uses it.`
      : state.state === 'retired' ? 'You confirmed this and later stopped using it. The history is kept; no review uses it.'
      : 'Not confirmed. No review, brief or model request uses this.'}</p>
    {state.state === 'confirmed' && state.lessonId && <button type="button" disabled={busy} onClick={() => void send({ action: 'retire', lessonId: state.lessonId })}>{busy ? 'Retiring…' : 'Stop using this lesson'}</button>}

    <h3>4 · Later application</h3>
    <p>Unknown: no later decision on a different problem has been recorded as using this rule.</p>
    <h3>5 · Outcome</h3>
    <p>Unknown: nothing has been observed. This lesson has not been shown to carry.</p>
    {message && <p role="alert">{message}</p>}
  </details>
}
