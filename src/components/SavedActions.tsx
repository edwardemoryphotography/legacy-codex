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

export default function SavedActions({ missionId, onActiveChange }: { missionId?: string; onActiveChange?: (missionId: string, active: boolean) => void }) {
  const [actions, setActions] = useState<SavedAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
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
        if (missionId) onActiveChange?.(missionId, saved.some(action => action.status !== 'DONE'))
      }
    } catch {
      if (!cancelled()) setError('Could not read your saved actions. Your work has not been changed.')
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [missionId, onActiveChange])

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
      onActiveChange?.(missionId, true)
      setTitle(''); setNotice('Next action saved. It will be here when you return.')
    } catch {
      setNotice('Could not save. Keep your text and retry. If another tab saved an action, refresh the list first.')
    } finally { setSaving(false) }
  }

  const openActions = actions.filter(action => action.status !== 'DONE')
  const doneActions = actions.filter(action => action.status === 'DONE')
  return (
    <section className="space-y-4 mt-6 pt-6" style={{ borderTop: '1px solid var(--line)' }} aria-label="Saved next actions">
      <h3 className="text-xl font-semibold">{missionId ? 'Your next action' : 'Pick up where you left off'}</h3>
      {loading ? <p role="status">Reading your saved actions…</p> : error ? (
        <div role="alert"><p>{error}</p><ActionBtn onClick={() => { setLoading(true); void load() }}>Retry saved actions</ActionBtn></div>
      ) : <>
        {openActions.map(action => <ActionCard key={`${action.id}:${action.updated_at}`} action={action} onSaved={saved => {
          const updated = actions.map(item => item.id === saved.id ? saved : item)
          setActions(updated)
          if (missionId) onActiveChange?.(missionId, updated.some(item => item.status !== 'DONE'))
        }} />)}
        {!openActions.length && (missionId ? <div className="space-y-3">
          <p>Name one concrete step you want to take. Saving it is a commitment, not proof that it is done.</p>
          <label htmlFor="saved-action-title" className="sr-only">Next action to save</label>
          <Input id="saved-action-title" value={title} onChange={setTitle} placeholder="What will you do next?" />
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

function ActionCard({ action, onSaved }: { action: SavedAction; onSaved: (action: SavedAction) => void }) {
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
  return <article className="space-y-3 rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
    <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{action.mission.title} · {action.status === 'IN_PROGRESS' ? 'In progress' : 'Ready to resume'}{action.mission.state !== 'primary' ? ` · Mission ${action.mission.state}` : ''}</p>
    <h4 className="text-lg font-semibold">{action.action_title}</h4>
    <label htmlFor={`resume-${action.id}`}>Leave yourself a starting point</label>
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
