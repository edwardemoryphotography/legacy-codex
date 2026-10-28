'use client'

import { useState } from 'react'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useMissionTerritory } from '@/hooks/useMissionTerritory'
import MissionBriefPanel, { BriefOutput } from '@/components/MissionBriefPanel'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, SectionSubtitle, SectionTitle, Select, Textarea } from '@/components/ui'

export { ACTIONS_READ_FAILED_COPY, BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'

// A read-only, display-only companion to Mission: it asks the model about the
// same real mission rows Mission itself reads, and shows the answer. It
// never writes anything — no mission_events row, no Strategic Delta
// provenance, nothing Mission's accept/correct lifecycle has to account
// for. See src/lib/dailyBrief.ts and src/app/api/brief/route.ts.
export default function BriefTab() {
  const { missions, loadError, actions, actionsRead } = useMissionTerritory()
  const brief = useBriefRunner()
  const [question, setQuestion] = useState('')
  const [chosenId, setChosenId] = useState('')

  const focus = missions?.find(m => m.id === chosenId) ?? missions?.find(m => m.state === 'primary') ?? missions?.[0] ?? null
  const focusAction = focus ? actions.find(a => a.mission_id === focus.id) ?? null : null
  const missionCount = missions?.length ?? 0
  const busy = brief.status === 'running'
  const unavailable = !brief.configured || brief.visitor

  const runRoster = (mode: 'daily_brief' | 'triage' | 'question', q?: string) =>
    void brief.run(mode, { mode, question: q, missions: missionsToBriefContext(missions ?? []), missionIds: (missions ?? []).slice(0, 40).map(mission => mission.id) })

  const askQuestion = () => {
    const q = question.trim()
    if (q) runRoster('question', q)
  }

  return (
    <section>
      <SectionTitle>Brief</SectionTitle>
      <SectionSubtitle>
        Ask about your real missions — grounded only in what is actually in Legacy Codex right now. A
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
            {!brief.configured && !brief.visitor && <Badge tone="amber">AI provider not configured on server</Badge>}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <ActionBtn onClick={() => runRoster('daily_brief')} disabled={busy || unavailable}>
              {busy && brief.activeMode === 'daily_brief' ? 'Thinking…' : 'Daily Brief'}
            </ActionBtn>
            <ActionBtn variant="secondary" onClick={() => runRoster('triage')} disabled={busy || unavailable}>
              {busy && brief.activeMode === 'triage' ? 'Thinking…' : 'Triage stalled work'}
            </ActionBtn>
          </div>

          {focus && (
            <Card className="mb-4">
              <FieldLabel htmlFor="brief-mission">One mission</FieldLabel>
              <Select id="brief-mission" value={focus.id} onChange={id => { brief.reset(); setChosenId(id) }}>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title || 'Untitled mission'} · {m.state}
                  </option>
                ))}
              </Select>
              <div className="mt-3">
                <MissionBriefPanel key={focus.id} mission={focus} action={focusAction} actionsRead={actionsRead} brief={brief} />
              </div>
            </Card>
          )}

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
                {busy && brief.activeMode === 'question' ? 'Thinking…' : 'Ask'}
              </ActionBtn>
            </div>
          </div>
        </>
      )}

      <BriefOutput brief={brief} />
    </section>
  )
}
