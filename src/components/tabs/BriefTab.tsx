'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession, missionConnectionMessage } from '@/lib/supabase/missionSession'
import { rowToMission, type MissionRow } from './MissionTab'
import { actionToBriefContext, missionToBriefContext, missionsToBriefContext, UNKNOWN_LINE, type BriefMode, type BriefTarget } from '@/lib/dailyBrief'
import type { Mission } from '@/types'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, SectionSubtitle, SectionTitle, Select, Textarea } from '@/components/ui'

type Status = 'idle' | 'running' | 'done' | 'error'

// The one unfinished saved action per mission (see the unique index in
// 20260906002630_enforce_one_unfinished_mission_action.sql).
interface OpenAction {
  id: string
  mission_id: string
  action_title: string
  status: string
  resume_note: string | null
}

type Wall = 'blocker' | 'action'

export const ACTIONS_READ_FAILED_COPY = 'Unfinished actions could not be read right now, so Break Wall can only use saved blockers. Nothing was changed.'

// /api/brief is owner-only. A visitor's 403 is an expected boundary, not a
// failure: say so plainly, like Mission does for its owner-only review.
export const BRIEF_VISITOR_COPY = 'Brief is only on Eddie\u2019s account. Your missions are still saved privately.'

// A read-only, display-only companion to Mission: it asks Claude about the
// same real mission rows Mission itself reads, and shows the answer. It
// never writes anything — no mission_events row, no Strategic Delta
// provenance, nothing Mission's accept/correct lifecycle has to account
// for. See src/lib/dailyBrief.ts and src/app/api/brief/route.ts.
export default function BriefTab() {
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [configured, setConfigured] = useState(false)
  const [question, setQuestion] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [activeMode, setActiveMode] = useState<BriefMode | null>(null)
  const [visitor, setVisitor] = useState(false)
  const [actions, setActions] = useState<OpenAction[] | null>(null)
  const [actionsError, setActionsError] = useState(false)
  const [focusId, setFocusId] = useState('')
  const [wall, setWall] = useState<Wall | ''>('')

  useEffect(() => {
    fetch('/api/brief')
      .then(res => res.json())
      .then(data => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const user = await connectMissionSession()
        if (cancelled) return
        const { data, error } = await supabase.from('missions').select('*').eq('user_id', user.id)
        if (cancelled) return
        if (error) throw error
        const loaded = ((data ?? []) as MissionRow[]).map(rowToMission)
        setMissions(loaded)
        setFocusId((loaded.find(m => m.state === 'primary') ?? loaded[0])?.id ?? '')
        const open = await supabase.from('actions').select('id,mission_id,action_title,status,resume_note').not('mission_id', 'is', null).neq('status', 'DONE')
        if (cancelled) return
        if (open.error) setActionsError(true)
        else setActions((open.data ?? []) as OpenAction[])
      } catch (err) {
        if (!cancelled) setLoadError(missionConnectionMessage(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const focus = missions?.find(m => m.id === focusId) ?? null
  const focusAction = focus ? actions?.find(a => a.mission_id === focus.id) ?? null : null
  const walls: Wall[] = [...(focus?.blocker?.trim() ? ['blocker' as const] : []), ...(focusAction ? ['action' as const] : [])]
  const chosenWall = walls.includes(wall as Wall) ? (wall as Wall) : walls[0]

  const requestBody = (mode: BriefMode, q?: string) => {
    if ((mode !== 'architect' && mode !== 'unblock') || !focus) {
      return { mode, question: q, missions: missionsToBriefContext(missions ?? []), missionIds: (missions ?? []).slice(0, 40).map(mission => mission.id) }
    }
    const target: BriefTarget = {
      kind: mode === 'architect' ? 'mission' : chosenWall,
      evidenceRequirement: focus.evidenceRequirement,
      action: focusAction ? actionToBriefContext(focusAction) : null,
    }
    return { mode, missions: [missionToBriefContext(focus)], missionIds: [focus.id], target }
  }

  const run = async (mode: BriefMode, q?: string) => {
    if (!missions) return
    setStatus('running')
    setActiveMode(mode)
    setOutput('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(requestBody(mode, q)),
      })
      if (res.status === 403) {
        setVisitor(true)
        setStatus('idle')
        setActiveMode(null)
        return
      }
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setOutput(data.text || 'No brief text returned.')
      setStatus('done')
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const askQuestion = () => {
    const q = question.trim()
    if (!q) return
    void run('question', q)
  }

  const missionCount = missions?.length ?? 0
  const busy = status === 'running'
  const unavailable = !configured || visitor

  return (
    <section>
      <SectionTitle>Brief</SectionTitle>
      <SectionSubtitle>
        Ask Claude about your real missions — grounded only in what is actually in Legacy Codex right now. A
        proposal, not a commitment: nothing here is saved, accepted, or recorded as a Strategic Delta.
      </SectionSubtitle>

      {loadError && <HelperLine variant="error">{loadError}</HelperLine>}

      {!loadError && missions === null && <HelperLine>Loading your missions…</HelperLine>}

      {!loadError && missions !== null && missionCount === 0 && (
        <HelperLine>No missions yet — add one in Mission first. There is nothing to brief until then.</HelperLine>
      )}

      {!loadError && missions !== null && missionCount > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge tone="muted">
              {missionCount} mission{missionCount === 1 ? '' : 's'} in context
            </Badge>
            {!configured && !visitor && <Badge tone="amber">ANTHROPIC_API_KEY not set on server</Badge>}
          </div>

          {visitor && <HelperLine>{BRIEF_VISITOR_COPY}</HelperLine>}

          <div className="flex flex-wrap gap-2 mb-4">
            <ActionBtn onClick={() => void run('daily_brief')} disabled={busy || unavailable}>
              {busy && activeMode === 'daily_brief' ? 'Thinking…' : 'Daily Brief'}
            </ActionBtn>
            <ActionBtn variant="secondary" onClick={() => void run('triage')} disabled={busy || unavailable}>
              {busy && activeMode === 'triage' ? 'Thinking…' : 'Triage stalled work'}
            </ActionBtn>
          </div>

          <Card className="mb-4">
            <FieldLabel htmlFor="brief-mission">One mission</FieldLabel>
            <Select id="brief-mission" value={focusId} onChange={id => { setFocusId(id); setWall('') }}>
              {missions.map(m => (
                <option key={m.id} value={m.id}>
                  {m.title || 'Untitled mission'} · {m.state}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-2 mt-3">
              <ActionBtn variant="secondary" onClick={() => void run('architect')} disabled={busy || unavailable || !focus}>
                {busy && activeMode === 'architect' ? 'Thinking…' : 'Architect Scan'}
              </ActionBtn>
              <ActionBtn variant="secondary" onClick={() => void run('unblock')} disabled={busy || unavailable || !chosenWall}>
                {busy && activeMode === 'unblock' ? 'Thinking…' : 'Break Wall'}
              </ActionBtn>
            </div>
            <div className="mt-3">
              {walls.length > 1 ? (
                <>
                  <FieldLabel htmlFor="brief-wall">Wall to break</FieldLabel>
                  <Select id="brief-wall" value={chosenWall} onChange={value => setWall(value as Wall)}>
                    <option value="blocker">Blocker: {focus?.blocker}</option>
                    <option value="action">Unfinished action: {focusAction?.action_title}</option>
                  </Select>
                </>
              ) : chosenWall ? (
                <HelperLine>
                  Break Wall uses the saved {chosenWall === 'blocker' ? `blocker: ${focus?.blocker}` : `unfinished action: ${focusAction?.action_title}`}
                </HelperLine>
              ) : (
                <HelperLine>Break Wall needs a saved blocker{actionsError ? '' : ' or unfinished action'} on this mission. {UNKNOWN_LINE}.</HelperLine>
              )}
              {actionsError && <HelperLine variant="error">{ACTIONS_READ_FAILED_COPY}</HelperLine>}
            </div>
          </Card>

          <div className="mb-4">
            <Textarea
              value={question}
              onChange={setQuestion}
              rows={2}
              compact
              placeholder="Ask anything about your missions…"
            />
            <div className="mt-2">
              <ActionBtn variant="secondary" onClick={askQuestion} disabled={busy || unavailable || !question.trim()}>
                {busy && activeMode === 'question' ? 'Thinking…' : 'Ask'}
              </ActionBtn>
            </div>
          </div>
        </>
      )}

      {output && (
        <Card style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6 }}>{output}</Card>
      )}
    </section>
  )
}
