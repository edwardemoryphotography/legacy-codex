'use client'

import { useEffect, useMemo, useState } from 'react'
import { decodeLessonRelay } from '@/lib/lessonRelay'
import { supabase } from '@/lib/supabase/client'
import type { Mission } from '@/types'

interface ReceivedLesson {
  id: string
  rule: string
  whenToApply: string
  confirmedAt: string
}

export default function LessonRelayReceive({ missions, ready, onLessonWrite }: { missions: Mission[]; ready: boolean; onLessonWrite: () => void }) {
  const [code, setCode] = useState('')
  const [missionId, setMissionId] = useState('')
  const [scope, setScope] = useState<'mission' | 'account'>('mission')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [received, setReceived] = useState<ReceivedLesson[]>([])
  const [readPending, setReadPending] = useState(false)
  const [revision, setRevision] = useState(0)
  const relay = useMemo(() => decodeLessonRelay(code), [code])

  useEffect(() => {
    const supplied = new URLSearchParams(window.location.search).get('relay')
    if (supplied) setCode(supplied)
  }, [])
  useEffect(() => {
    if (missionId && missions.some(mission => mission.id === missionId)) return
    setMissionId(missions.find(mission => mission.state === 'primary')?.id ?? missions[0]?.id ?? '')
  }, [missions, missionId])
  useEffect(() => {
    if (!ready || !missionId) return
    let cancelled = false
    setReadPending(true)
    ;(async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) throw new Error('Your account could not be read.')
        const response = await fetch(`/api/lesson-relay?missionId=${encodeURIComponent(missionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const payload = await response.json() as { received?: ReceivedLesson[]; error?: string }
        if (!response.ok || !payload.received) throw new Error(payload.error || 'Could not load received lessons.')
        if (!cancelled) { setReceived(payload.received); setError('') }
      } catch {
        if (!cancelled) setError('Received lessons could not be loaded. Existing work is unchanged.')
      } finally { if (!cancelled) setReadPending(false) }
    })()
    return () => { cancelled = true }
  }, [ready, missionId, revision])

  async function request(body: object): Promise<boolean> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) throw new Error('Reconnect to your account before saving this lesson.')
      const response = await fetch('/api/lesson-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const payload = await response.json() as { received?: boolean; retired?: boolean; error?: string }
      if (!response.ok || (!payload.received && !payload.retired)) throw new Error(payload.error || 'The change was not saved.')
      onLessonWrite()
      setRevision(value => value + 1)
      setNotice(payload.received
        ? 'Lesson saved to your work. Future eligible project reviews can consider it under its conditions.'
        : 'Lesson stopped. Its history remains, but later reviews will not use it.')
      return true
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The lesson was not saved.')
      return false
    } finally { setBusy(false) }
  }

  const isRelayRelevant = Boolean(code.trim() || received.length > 0 || notice || error)

  return <section className="legacy-relay" data-active={isRelayRelevant ? 'true' : 'false'} aria-label="Receive lessons from others">
    <div className="legacy-relay-heading">
      <p className="legacy-relay-eyebrow">PASS IT FORWARD</p>
      <h2>My ceiling becomes someone else’s floor.</h2>
      {isRelayRelevant && (
        <p>Someone else’s hard-earned understanding can become a better starting point for your own work. You choose what to inherit. No one else’s private project records are transferred.</p>
      )}
    </div>
    {isRelayRelevant && <div className="legacy-relay-steps" aria-hidden="true"><span /><span /><span /><span /></div>}
    <details open={Boolean(code)}>
      <summary>Receive a shared lesson</summary>
      {missions.length === 0 ? <p>Start a mission first, then return here to carry this lesson into your own work.</p> : <>
        <label htmlFor="legacy-relay-code">Shared lesson link or code</label>
        <textarea id="legacy-relay-code" rows={3} value={code} onChange={event => { setCode(event.target.value); setNotice('') }}
          placeholder="Paste a Legacy Codex relay code…" />
        {code && !relay && <p role="alert">That relay is not readable. Check the link or code before proceeding.</p>}
        {relay && <div className="legacy-relay-preview" aria-label="Review the lesson before receiving">
          <strong>{relay.rule}</strong>
          <p>Only when: {relay.whenToApply}</p>
          <p>These are shared words, not independently verified evidence. Decide whether they fit your circumstances.</p>
        </div>}
        <label htmlFor="legacy-relay-mission">Carry into your mission</label>
        <select id="legacy-relay-mission" value={missionId} onChange={event => setMissionId(event.target.value)}>
          {missions.map(mission => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
        </select>
        <label htmlFor="legacy-relay-scope">Where should this lesson apply?</label>
        <select id="legacy-relay-scope" value={scope} onChange={event => setScope(event.target.value as 'mission' | 'account')}>
          <option value="mission">This mission only</option>
          <option value="account">Across my missions, when relevant</option>
        </select>
        <button type="button" disabled={busy || !ready || !relay || !missionId}
          onClick={async () => {
            const saved = await request({ action: 'receive', code, missionId, scope })
            if (saved) {
              setCode('')
              const url = new URL(window.location.href)
              url.searchParams.delete('relay')
              window.history.replaceState(window.history.state, '', url.toString())
            }
          }}>{busy ? 'Saving lesson…' : 'Inherit this lesson'}</button>
      </>}
    </details>
    {missions.length > 0 && <details>
      <summary>Lessons you’ve received for this mission {readPending ? '· Reading…' : `· ${received.length}`}</summary>
      {received.length === 0 && !readPending && !error && <p>No received lessons are saved for this mission.</p>}
      {received.map(lesson => <div className="legacy-relay-record" key={lesson.id}>
        <strong>{lesson.rule}</strong>
        <p>When it applies: {lesson.whenToApply}</p>
        <small>Received {new Date(lesson.confirmedAt).toLocaleDateString()} · original source not independently verified</small>
        <button type="button" disabled={busy} onClick={() => void request({ action: 'retire', lessonId: lesson.id })}>Stop using this lesson</button>
      </div>)}
      <p>Shows up to 50 recently saved lessons in this mission; retiring preserves their history.</p>
    </details>}
    {notice && <p className="legacy-relay-notice" role="status">{notice}</p>}
    {error && <p className="legacy-relay-error" role="alert">{error}</p>}
  </section>
}
