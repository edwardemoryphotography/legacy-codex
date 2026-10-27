'use client'

import { useState, type ReactNode } from 'react'
import { UNKNOWN_LINE } from '@/lib/dailyBrief'
import { activeState, GROUP_LABELS, groupTerritory, type TerritoryCard } from '@/lib/territory'
import { buildTerritoryGraph } from '@/lib/territoryGraph'
import TerritoryGraph from '@/components/TerritoryGraph'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useMissionTerritory, type ReadState } from '@/hooks/useMissionTerritory'
import MissionBriefPanel, { BriefOutput, BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, SectionSubtitle, SectionTitle } from '@/components/ui'

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export const GRAPH_PARTIAL_COPY = 'Some saved links could not be read right now, so the graph is missing them. Nothing was changed.'

export const EVENTS_READ_FAILED_COPY = 'Mission history could not be read right now, so last activity uses each mission’s own saved time and reported capacity is unknown.'

// Territory: the person's own saved missions, grouped by saved state, with
// Active State taken from data Mission already keeps. Read-only — every
// model call goes through /api/brief and is display-only.
export default function TerritoryTab() {
  const { missions, loadError, actions, actionsRead, events, eventsRead, evidence, evidenceRead } = useMissionTerritory({ withEvents: true })
  const [view, setView] = useState<'list' | 'graph'>('list')
  const brief = useBriefRunner()
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = missions ? groupTerritory(missions, actions, events) : []
  const open = groups.flatMap(g => g.cards).find(c => c.mission.id === openId) ?? null
  const select = (id: string | null) => {
    brief.reset()
    setOpenId(id)
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 })
  }

  return (
    <section>
      <SectionTitle>Territory</SectionTitle>
      <SectionSubtitle>
        Your saved missions, grouped by their saved state. Only what is saved is shown — nothing here is inferred,
        and nothing you ask here is saved.
      </SectionSubtitle>

      {loadError && <HelperLine variant="error">{loadError}</HelperLine>}
      {!loadError && missions === null && <HelperLine>Loading your missions…</HelperLine>}
      {!loadError && missions?.length === 0 && <HelperLine>{UNKNOWN_LINE} — add a mission in Mission first.</HelperLine>}

      {!loadError && missions && missions.length > 0 && (
        open ? (
          <>
            <div className="mb-3">
              <ActionBtn variant="secondary" onClick={() => select(null)}>← All missions</ActionBtn>
            </div>
            <Card className="mb-4">
              <MissionFacts card={open} actionsRead={actionsRead} heading />
              {brief.visitor && <HelperLine>{BRIEF_VISITOR_COPY}</HelperLine>}
              <div className="mt-3">
                <MissionBriefPanel key={open.mission.id} mission={open.mission} action={open.action} actionsRead={actionsRead} brief={brief} withTriageAndAsk />
              </div>
            </Card>
            <BriefOutput brief={brief} />
          </>
        ) : (
          <>
            <ActiveStateCard actionsRead={actionsRead} eventsRead={eventsRead} state={activeState(missions, actions, events)} />
            {eventsRead === 'failed' && <HelperLine variant="error">{EVENTS_READ_FAILED_COPY}</HelperLine>}
            <div className="flex gap-2 mb-3" role="group" aria-label="Territory view">
              <ActionBtn variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>List</ActionBtn>
              <ActionBtn variant={view === 'graph' ? 'primary' : 'secondary'} onClick={() => setView('graph')}>Graph</ActionBtn>
            </div>
            {view === 'graph' && (
              <>
                {[actionsRead, eventsRead, evidenceRead].includes('failed') && <HelperLine variant="error">{GRAPH_PARTIAL_COPY}</HelperLine>}
                <TerritoryGraph {...buildTerritoryGraph(missions, actions, events, evidence)} blocked={new Set(missions.filter(m => m.state === 'blocked').map(m => m.id))} onOpen={select} />
              </>
            )}
            {view === 'list' && groups.map(({ group, cards }) => (
              <div key={group} className="mb-4">
                <h3 className="font-bold mb-2" style={{ fontSize: '0.95rem' }}>
                  {GROUP_LABELS[group]} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>({cards.length})</span>
                </h3>
                {cards.map(card => (
                  <button
                    key={card.mission.id}
                    type="button"
                    onClick={() => select(card.mission.id)}
                    className="card interactive-control"
                    style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                    aria-label={`Open ${card.mission.title || 'Untitled mission'}`}
                  >
                    <MissionFacts card={card} actionsRead={actionsRead} />
                  </button>
                ))}
              </div>
            ))}
          </>
        )
      )}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm mt-1" style={{ overflowWrap: 'anywhere' }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}: </span>
      {children}
    </p>
  )
}

function MissionFacts({ card, actionsRead, heading = false }: { card: TerritoryCard; actionsRead: ReadState; heading?: boolean }) {
  const { mission, action } = card
  const actionText = actionsRead === 'failed' ? 'could not be read' : actionsRead === 'pending' ? 'loading…' : action ? `${action.action_title} (${action.status})` : 'none saved'
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {heading ? <h3 className="font-bold" style={{ overflowWrap: 'anywhere' }}>{mission.title || 'Untitled mission'}</h3> : <strong style={{ overflowWrap: 'anywhere' }}>{mission.title || 'Untitled mission'}</strong>}
        <Badge tone={mission.state === 'blocked' ? 'amber' : 'muted'}>{mission.state}</Badge>
        {mission.capacityMismatch && <Badge tone="amber">capacity mismatch reported</Badge>}
      </div>
      <Fact label="Finish line">{mission.finishLine || UNKNOWN_LINE}</Fact>
      {mission.blocker && <Fact label="Blocker">{mission.blocker}</Fact>}
      <Fact label="Unfinished action">{actionText}</Fact>
      <Fact label="Last activity">{when(card.lastActivity)}</Fact>
    </>
  )
}

function ActiveStateCard({ state, actionsRead, eventsRead }: {
  state: ReturnType<typeof activeState>
  actionsRead: ReadState
  eventsRead: ReadState
}) {
  const { primary, capacity, nextSafeAction } = state
  return (
    <Card className="mb-4">
      <FieldLabel>Active state</FieldLabel>
      <Fact label="Primary mission">{primary ? primary.title || 'Untitled mission' : UNKNOWN_LINE}</Fact>
      <Fact label="Reported capacity">
        {!primary ? UNKNOWN_LINE
          : !capacity.mismatch ? 'No capacity mismatch reported'
          : capacity.reported ? `${capacity.reported.level} — mismatch reported ${when(capacity.reported.at)}`
          : eventsRead === 'failed' ? 'Mismatch reported; level could not be read'
          : 'Mismatch reported; level not in recent history'}
      </Fact>
      {capacity.mismatch && (
        <HelperLine>
          Mission’s existing rule: with a capacity mismatch reported, your Secondary is the one to work on —{' '}
          {capacity.secondary ? capacity.secondary.title || 'Untitled mission' : `${UNKNOWN_LINE} (no Secondary)`}. Change it in Mission.
        </HelperLine>
      )}
      <Fact label="Next safe action">
        {!primary ? UNKNOWN_LINE
          : actionsRead === 'failed' ? 'Could not be read right now'
          : actionsRead === 'pending' ? 'Loading…'
          : nextSafeAction ? `${nextSafeAction.action_title} (${nextSafeAction.status})`
          : UNKNOWN_LINE}
      </Fact>
    </Card>
  )
}
