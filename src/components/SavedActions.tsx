'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'
import { ActionBtn, Input, Textarea } from '@/components/ui'

type SavedAction = {
  id: string
  mission_id: string
  action_title: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  resume_note: string | null
  updated_at: string
  mission: { title: string; state: string }
}

const fields = 'id,mission_id,action_title,status,resume_note,updated_at,mission:missions!inner(title,state)'

export default function SavedActions({
  missionId,
  suggestedTitle,
  onActiveChange,
}: {
  missionId?: string
  /** The recommendation the person just accepted, if any. Seeds the
   *  composer once so the saved action can use the same words. Never
   *  written for them — saving stays an explicit commitment. */
  suggestedTitle?: string | null
  onActiveChange?: (missionId: string, active: boolean) => void
}) {
  const [actions, setActions] = useState<SavedAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async (cancelled: () => boolean = () => false) => {
    try {
      await connectMissionSession()
      let query = supabase.from('actions').select(fields).not('mission_id', 'is', null).order('updated_at', { ascending: false })
      if (missionId) query = query.eq('mission_id', missionId)
      const { data, error: readError } = await query
      if (readError) throw readError
      if (!cancelled()) {
        const saved = (data ?? []) as unknown as SavedAction[]
        setActions(saved); setError('')
      }
    } catch {
      if (!cancelled()) setError('Could not read your saved actions. Your work has not been changed.')
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [missionId])

  const hasOpenAction = actions.some(action => action.status !== 'DONE')
  useEffect(() => {
    if (missionId && !loading && !error) onActiveChange?.(missionId, hasOpenAction)
  }, [missionId, loading, error, hasOpenAction, onActiveChange])

  useEffect(() => {
    if (!suggestedTitle || titleTouched) return
    // Seeding the composer from an accepted recommendation is a reaction to
    // that prop, not a render-time derivation — the field stays editable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(suggestedTitle)
  }, [suggestedTitle, titleTouched])

  useEffect(() => {
    let cancelled = false
    // The connection and reads are asynchronous; no state is set on setup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(() => cancelled)
    return () => { cancelled = true }
  }, [load])

  async function saveAction() {
    if (!missionId || !title.trim() || saving) return
    setSaving(true); setNotice('')
    try {
      const { data, error: writeError } = await supabase.from('actions').insert({
        mission_id: missionId, action_title: title.trim(), status: 'TODO', is_next_action: true,
      }).select(fields).single()
      if (writeError || !data) throw writeError ?? new Error('No saved action returned')
      setActions(previous => [data as unknown as SavedAction, ...previous])
      setTitle(''); setNotice('Next action saved. It will be here when you return.')
    } catch {
      setNotice('Could not save. Keep your text and retry. If another tab saved an action, refresh the list first.')
    } finally { setSaving(false) }
  }

  const openActions = actions.filter(action => action.status !== 'DONE')
  const doneActions = actions.filter(action => action.status === 'DONE')
  return (
    <section className="commitment-panel" id="saved-action" aria-label="Saved next actions">
      <p className="commitment-kicker">Saved action</p>
      <h3>{missionId ? 'The action you can return to' : 'Pick up where you left off'}</h3>
      <p className="commitment-lead">
        {missionId
          ? 'This is a commitment, separate from the recommendation above. The note stays with the same action when you come back.'
          : 'These are the actions you saved. Each note is the starting point you left yourself.'}
      </p>
      {loading ? <p role="status">Reading your saved actions…</p> : error ? (
        <div role="alert"><p>{error}</p><ActionBtn onClick={() => { setLoading(true); void load() }}>Retry saved actions</ActionBtn></div>
      ) : <>
        {openActions.map(action => <ActionCard key={`${action.id}:${action.updated_at}`} action={action} matchesRecommendation={action.action_title === suggestedTitle} onSaved={saved => {
          setActions(previous => previous.map(item => item.id === saved.id ? saved : item))
        }} />)}
        {!openActions.length && (missionId ? <div className="space-y-3">
          <p>Name one concrete step you want to take. Saving it is a commitment, not proof that it is done.</p>
          <label htmlFor="saved-action-title">Name the action to save</label>
          <Input id="saved-action-title" value={title} onChange={value => { setTitleTouched(true); setTitle(value) }} placeholder="What will you do next?" />
          <ActionBtn disabled={saving || !title.trim()} onClick={saveAction}>{saving ? 'Saving…' : 'Save next action'}</ActionBtn>
        </div> : <p>No unfinished actions are saved. Choose your next action on the Mission screen.</p>)}
        {doneActions.length > 0 && <details><summary>Actions you marked done ({doneActions.length})</summary>
          {doneActions.map(action => <div key={action.id} className="mt-3"><p>{action.action_title}</p><p className="text-sm" style={{ color: 'var(--text-dim)' }}>{action.resume_note || 'No completion note saved.'}</p></div>)}
        </details>}
        <button type="button" className="underline text-sm" onClick={() => { setLoading(true); void load() }}>Refresh saved actions</button>
      </>}
      {notice && <p role="status">{notice}</p>}
    </section>
  )
}

function ActionCard({ action, onSaved, matchesRecommendation }: { action: SavedAction; onSaved: (action: SavedAction) => void; matchesRecommendation?: boolean }) {
  const [note, setNote] = useState(action.resume_note ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function update(status: SavedAction['status']) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.from('actions').update({
        status, resume_note: note.trim() || null, is_next_action: status !== 'DONE',
      }).eq('id', action.id).eq('updated_at', action.updated_at).select(fields).single()
      if (error || !data) throw error ?? new Error('No updated row')
      onSaved(data as unknown as SavedAction)
    } catch {
      setMessage('Could not save this change. Your note is still here. Copy it before refreshing if another tab changed this action.')
    } finally { setBusy(false) }
  }
  return <article className="commitment-card">
    <p className="commitment-meta">{action.mission.title} · {action.status === 'IN_PROGRESS' ? 'In progress' : 'Ready to resume'}{action.mission.state !== 'primary' ? ` · Mission ${action.mission.state}` : ''}</p>
    <h4 className="commitment-title">{action.action_title}</h4>
    {matchesRecommendation && <p className="commitment-same">Same words as the recommendation you accepted.</p>}
    <label htmlFor={`resume-${action.id}`}>Starting point</label>
    <Textarea id={`resume-${action.id}`} value={note} onChange={setNote} rows={3} placeholder="Where did you stop? What should you do when you return?" />
    <div className="flex flex-wrap gap-3">
      {action.status !== 'IN_PROGRESS' && <ActionBtn disabled={busy} onClick={() => update('IN_PROGRESS')}>Start / resume</ActionBtn>}
      <ActionBtn disabled={busy} onClick={() => update(action.status)}>Save note</ActionBtn>
      {action.status === 'IN_PROGRESS' && <ActionBtn disabled={busy || !note.trim()} onClick={() => update('TODO')}>Save & pause</ActionBtn>}
      <ActionBtn disabled={busy || !note.trim()} onClick={() => update('DONE')}>Mark done with note</ActionBtn>
    </div>
    <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Marking this done records your report; it does not verify the mission’s finish line.</p>
    {busy && <p role="status">Saving…</p>}
    {message && <p role="alert">{message}</p>}
  </article>
}
