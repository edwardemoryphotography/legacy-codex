'use client'

import { useState } from 'react'
import { singleMissionRequest, UNKNOWN_LINE, type BriefMode } from '@/lib/dailyBrief'
import type { OpenAction } from '@/lib/territory'
import type { BriefRunner } from '@/hooks/useBriefRunner'
import type { ReadState } from '@/hooks/useMissionTerritory'
import type { Mission } from '@/types'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, Select, Textarea } from '@/components/ui'

type Wall = 'blocker' | 'action'

export const ACTIONS_READ_FAILED_COPY = 'Unfinished actions could not be read right now, so Architect Scan is off and Break Wall can only use saved blockers. Nothing was changed.'

// /api/brief is owner-only. A visitor's 403 is an expected boundary, not a
// failure: say so plainly, like Mission does for its owner-only review.
export const BRIEF_VISITOR_COPY = 'Brief is only on Eddie’s account. Your missions are still saved privately.'

const MODE_LABELS: Partial<Record<BriefMode, string>> = { architect: 'Architect Scan', unblock: 'Break Wall', triage: 'Triage', question: 'Ask' }

// Model calls about ONE mission. Render with key={mission.id} so the chosen
// wall and question reset with the mission; the parent resets the runner.
export default function MissionBriefPanel({ mission, action, actionsRead, brief, withTriageAndAsk = false }: {
  mission: Mission
  action: OpenAction | null
  actionsRead: ReadState
  brief: BriefRunner
  withTriageAndAsk?: boolean
}) {
  const [wall, setWall] = useState<Wall | ''>('')
  const [question, setQuestion] = useState('')
  const walls: Wall[] = [...(mission.blocker?.trim() ? ['blocker' as const] : []), ...(action ? ['action' as const] : [])]
  const chosenWall = walls.includes(wall as Wall) ? (wall as Wall) : walls[0]
  const wallText = chosenWall === 'action' ? `unfinished action: ${action?.action_title}` : `blocker: ${mission.blocker}`
  const busy = brief.status === 'running'
  const unavailable = !brief.configured || brief.visitor

  const ask = (mode: BriefMode) => {
    const label = `${MODE_LABELS[mode]} · ${mission.title || 'Untitled mission'}${mode === 'unblock' ? ` · ${wallText}` : ''}`
    void brief.run(mode, singleMissionRequest(mode, mission, action, chosenWall ?? 'blocker', mode === 'question' ? question.trim() : undefined), label)
  }
  const thinking = (mode: BriefMode) => busy && brief.activeMode === mode

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* An unread action list is not an empty one: Architect Scan would
            report a saved commitment as unsaved, so it waits for the read. */}
        <ActionBtn variant="secondary" onClick={() => ask('architect')} disabled={busy || unavailable || actionsRead !== 'ok'}>
          {thinking('architect') ? 'Thinking…' : 'Architect Scan'}
        </ActionBtn>
        <ActionBtn variant="secondary" onClick={() => ask('unblock')} disabled={busy || unavailable || !chosenWall || actionsRead === 'pending'}>
          {thinking('unblock') ? 'Thinking…' : 'Break Wall'}
        </ActionBtn>
        {withTriageAndAsk && (
          <ActionBtn variant="secondary" onClick={() => ask('triage')} disabled={busy || unavailable}>
            {thinking('triage') ? 'Thinking…' : 'Triage'}
          </ActionBtn>
        )}
      </div>
      <div className="mt-3">
        {walls.length > 1 ? (
          <>
            <FieldLabel htmlFor={`wall-${mission.id}`}>Wall to break</FieldLabel>
            <Select id={`wall-${mission.id}`} value={chosenWall} onChange={value => { brief.reset(); setWall(value as Wall) }}>
              <option value="blocker">Blocker: {mission.blocker}</option>
              <option value="action">Unfinished action: {action?.action_title}</option>
            </Select>
          </>
        ) : chosenWall ? (
          <HelperLine>Break Wall uses the saved {wallText}</HelperLine>
        ) : (
          <HelperLine>Break Wall needs a saved blocker{actionsRead === 'failed' ? '' : ' or unfinished action'} on this mission. {UNKNOWN_LINE}.</HelperLine>
        )}
        {actionsRead === 'failed' && <HelperLine variant="error">{ACTIONS_READ_FAILED_COPY}</HelperLine>}
      </div>
      {withTriageAndAsk && (
        <div className="mt-3">
          <FieldLabel htmlFor={`ask-${mission.id}`}>Ask about this mission</FieldLabel>
          <Textarea id={`ask-${mission.id}`} value={question} onChange={setQuestion} rows={2} compact placeholder="Ask about this mission…" />
          <div className="mt-2">
            <ActionBtn variant="secondary" onClick={() => ask('question')} disabled={busy || unavailable || !question.trim()}>
              {thinking('question') ? 'Thinking…' : 'Ask'}
            </ActionBtn>
          </div>
        </div>
      )}
    </div>
  )
}

export function BriefOutput({ brief }: { brief: BriefRunner }) {
  if (!brief.output) return null
  return (
    <Card style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.6 }}>
      {brief.outputLabel && <Badge tone="muted">{brief.outputLabel}</Badge>}
      {brief.outputLabel ? `\n${brief.output}` : brief.output}
    </Card>
  )
}
