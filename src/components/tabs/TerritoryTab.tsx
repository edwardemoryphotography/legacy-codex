'use client'

import { useState, type ReactNode } from 'react'
import { UNKNOWN_LINE } from '@/lib/dailyBrief'
import { activeState, GROUP_LABELS, groupTerritory, type TerritoryCard } from '@/lib/territory'
import TerritoryGraph from '@/components/TerritoryGraph'
import { useBriefRunner } from '@/hooks/useBriefRunner'
import { useMissionTerritory, type ReadState } from '@/hooks/useMissionTerritory'
import { TERRITORY_NODES_READ_FAILED_COPY, useTerritoryNodes } from '@/hooks/useTerritoryNodes'
import MissionBriefPanel, { BriefOutput, BRIEF_VISITOR_COPY } from '@/components/MissionBriefPanel'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import {
  TERRITORY_ENTITY_KINDS,
  TERRITORY_KIND_LABELS,
  TERRITORY_KIND_ORDER,
  TERRITORY_SIGNAL_LABELS,
  TERRITORY_SIGNALS,
  type TerritoryEntity,
  type TerritoryEntityInput,
  type TerritoryEntityKind,
  type TerritorySignal,
} from '@/lib/territoryEntities'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, Input, SectionSubtitle, SectionTitle, Select, Textarea } from '@/components/ui'

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export const GRAPH_PARTIAL_COPY = 'Some saved links could not be read right now, so the graph is missing them. Nothing was changed.'

export const GRAPH_TRUNCATED_COPY = 'Only your newest 5,000 lessons and corrections were read, so older ones may be missing from the graph.'

export const EVENTS_READ_FAILED_COPY = 'Mission history could not be read right now, so last activity uses each mission’s own saved time and reported capacity is unknown.'

type Lens = 'all' | 'mission' | TerritoryEntityKind
type View = 'map' | 'list'
type EditorState = { mode: 'new' } | { mode: 'edit'; entity: TerritoryEntity }

const LENSES: { key: Lens; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mission', label: 'Missions' },
  { key: 'project', label: 'Projects' },
  { key: 'doctrine', label: 'Doctrine' },
  { key: 'constraint', label: 'Constraints' },
]

const EMPTY_INPUT: TerritoryEntityInput = { kind: 'project', label: '', description: '', signal: null, cluster: null }

// Territory: saved missions plus first-class projects, doctrine and
// constraints. Read-only mission/AI paths stay read-only; territory entities
// have their own owner-scoped table. No inferred links are drawn.
export default function TerritoryTab() {
  const { missions, loadError, actions, actionsRead, events, eventsRead, evidence, evidenceRead, links, linksRead, linksTruncated } = useMissionTerritory({ withEvents: true })
  const territory = useTerritoryNodes()
  const [view, setView] = useState<View>('map')
  const [lens, setLens] = useState<Lens>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [openEntityId, setOpenEntityId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const brief = useBriefRunner()

  const entities = territory.nodes ?? []
  const groups = missions ? groupTerritory(missions, actions, events) : []
  const open = groups.flatMap(g => g.cards).find(c => c.mission.id === openId) ?? null
  const openEntity = openEntityId ? entities.find(entity => entity.id === openEntityId) ?? null : null
  const filteredMissions = lens === 'all' || lens === 'mission' ? missions ?? [] : []
  const filteredEntities = lens === 'all' ? entities : lens === 'mission' ? [] : entities.filter(entity => entity.kind === lens)
  const entityGroups = TERRITORY_KIND_ORDER.map(kind => ({ kind, items: filteredEntities.filter(entity => entity.kind === kind) })).filter(group => group.items.length > 0)
  const hasAny = (missions?.length ?? 0) > 0 || entities.length > 0

  const scrollTop = () => {
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 })
  }
  const selectMission = (id: string) => {
    brief.reset()
    setOpenId(id)
    setOpenEntityId(null)
    setEditor(null)
    scrollTop()
  }
  const selectEntity = (id: string) => {
    brief.reset()
    setOpenEntityId(id)
    setOpenId(null)
    setEditor(null)
    scrollTop()
  }
  const back = () => {
    brief.reset()
    setOpenId(null)
    setOpenEntityId(null)
    setEditor(null)
    scrollTop()
  }
  const saveEntity = async (input: TerritoryEntityInput) => {
    const result = editor?.mode === 'edit' ? await territory.update(editor.entity.id, input) : await territory.create(input)
    if (result.ok) {
      setEditor(null)
      if (editor?.mode === 'edit') setOpenEntityId(result.entity.id)
    }
    return result
  }
  const deleteEntity = async (entity: TerritoryEntity) => {
    const result = await territory.remove(entity.id)
    if (result.ok) back()
    return result
  }

  const countFor = (key: Lens) => key === 'all' ? (missions?.length ?? 0) + entities.length
    : key === 'mission' ? missions?.length ?? 0
    : entities.filter(entity => entity.kind === key).length

  return (
    <section>
      <SectionTitle>Territory</SectionTitle>
      <SectionSubtitle>
        Your saved missions and the projects, doctrine and constraints they live inside. Only what is saved is shown.
        Missions can be opened; entities are named, not inferred.
      </SectionSubtitle>

      {loadError && <HelperLine variant="error">{loadError}</HelperLine>}
      {!loadError && missions === null && <HelperLine>Loading your missions…</HelperLine>}
      {!loadError && missions !== null && territory.readState === 'pending' && !hasAny && <HelperLine>Loading territory entities…</HelperLine>}
      {!loadError && missions !== null && !hasAny && territory.readState !== 'pending' && (
        <HelperLine>{UNKNOWN_LINE} — add a mission in Mission first, or add a project, doctrine, or constraint here.</HelperLine>
      )}
      {territory.readState === 'failed' && <HelperLine variant="error">{TERRITORY_NODES_READ_FAILED_COPY}</HelperLine>}

      {!loadError && missions !== null && hasAny && (
        open ? (
          <MissionDetail card={open} actionsRead={actionsRead} brief={brief} onBack={back} />
        ) : openEntity ? (
          editor ? (
            <>
              <div className="mb-3"><ActionBtn variant="secondary" onClick={() => setEditor(null)}>← Back to entity</ActionBtn></div>
              <EntityEditor
                initial={openEntity}
                onSave={saveEntity}
                onCancel={() => setEditor(null)}
              />
            </>
          ) : (
            <EntityDetail
              entity={openEntity}
              onBack={back}
              onEdit={() => setEditor({ mode: 'edit', entity: openEntity })}
              onDelete={() => deleteEntity(openEntity)}
            />
          )
        ) : (
          <>
            {editor && (
              <EntityEditor
                initial={editor.mode === 'edit' ? editor.entity : null}
                onSave={saveEntity}
                onCancel={() => setEditor(null)}
              />
            )}

            {missions.length > 0 && <ActiveStateCard actionsRead={actionsRead} eventsRead={eventsRead} state={activeState(missions, actions, events)} />}
            {eventsRead === 'failed' && <HelperLine variant="error">{EVENTS_READ_FAILED_COPY}</HelperLine>}

            <div className="flex flex-wrap gap-2 mb-2">
              {(['daily_brief', 'triage'] as const).map(mode => (
                <ActionBtn
                  key={mode}
                  variant={mode === 'daily_brief' ? 'primary' : 'secondary'}
                  disabled={brief.status === 'running' || !brief.configured || brief.visitor || missions.length === 0}
                  onClick={() => void brief.run(mode, { mode, missions: missionsToBriefContext(missions), missionIds: missions.slice(0, 40).map(m => m.id) }, mode === 'daily_brief' ? 'Daily Brief · all missions' : 'Triage · all missions')}
                >
                  {brief.status === 'running' && brief.activeMode === mode ? 'Thinking…' : mode === 'daily_brief' ? 'Daily Brief' : 'Triage'}
                </ActionBtn>
              ))}
              <ActionBtn variant="secondary" onClick={() => setEditor({ mode: 'new' })}>+ Add entity</ActionBtn>
            </div>
            {brief.visitor && <HelperLine>{BRIEF_VISITOR_COPY}</HelperLine>}
            <div className="mb-3"><BriefOutput brief={brief} /></div>

            <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Territory lens">
              {LENSES.map(item => (
                <ActionBtn key={item.key} variant={lens === item.key ? 'primary' : 'secondary'} onClick={() => setLens(item.key)}>
                  {item.label} ({countFor(item.key)})
                </ActionBtn>
              ))}
            </div>
            <div className="flex gap-2 mb-3" role="group" aria-label="Territory view">
              <ActionBtn variant={view === 'map' ? 'primary' : 'secondary'} onClick={() => setView('map')}>Map</ActionBtn>
              <ActionBtn variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>List</ActionBtn>
            </div>

            {view === 'map' && (
              <>
                {[actionsRead, linksRead, evidenceRead].includes('failed') && <HelperLine variant="error">{GRAPH_PARTIAL_COPY}</HelperLine>}
                {linksTruncated && <HelperLine>{GRAPH_TRUNCATED_COPY}</HelperLine>}
                {filteredMissions.length === 0 && filteredEntities.length === 0
                  ? <HelperLine>Nothing saved in this lens yet.</HelperLine>
                  : <TerritoryGraph missions={filteredMissions} actions={actions} links={links} evidence={evidence} entities={filteredEntities} onOpen={selectMission} onOpenEntity={selectEntity} />}
              </>
            )}
            {view === 'list' && (
              <>
                {entityGroups.map(({ kind, items }) => (
                  <div key={kind} className="mb-4">
                    <h3 className="font-bold mb-2" style={{ fontSize: '0.95rem' }}>
                      {TERRITORY_KIND_LABELS[kind]} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>({items.length})</span>
                    </h3>
                    {items.map(entity => <EntityCard key={entity.id} entity={entity} onOpen={() => selectEntity(entity.id)} />)}
                  </div>
                ))}
                {(lens === 'all' || lens === 'mission') && groups.map(({ group, cards }) => (
                  <div key={group} className="mb-4">
                    <h3 className="font-bold mb-2" style={{ fontSize: '0.95rem' }}>
                      {GROUP_LABELS[group]} <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>({cards.length})</span>
                    </h3>
                    {cards.map(card => (
                      <button
                        key={card.mission.id}
                        type="button"
                        onClick={() => selectMission(card.mission.id)}
                        className="card interactive-control"
                        style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
                        aria-label={`Open ${card.mission.title || 'Untitled mission'}`}
                      >
                        <MissionFacts card={card} actionsRead={actionsRead} />
                      </button>
                    ))}
                  </div>
                ))}
                {filteredMissions.length === 0 && entityGroups.length === 0 && <HelperLine>Nothing saved in this lens yet.</HelperLine>}
              </>
            )}
          </>
        )
      )}
    </section>
  )
}

function MissionDetail({ card, actionsRead, brief, onBack }: {
  card: TerritoryCard
  actionsRead: ReadState
  brief: ReturnType<typeof useBriefRunner>
  onBack: () => void
}) {
  return (
    <>
      <div className="mb-3"><ActionBtn variant="secondary" onClick={onBack}>← All missions</ActionBtn></div>
      <Card className="mb-4">
        <MissionFacts card={card} actionsRead={actionsRead} heading />
        <div className="mt-3">
          <MissionBriefPanel key={card.mission.id} mission={card.mission} action={card.action} actionsRead={actionsRead} brief={brief} withTriageAndAsk />
        </div>
      </Card>
      <BriefOutput brief={brief} />
    </>
  )
}

function EntityCard({ entity, onOpen }: { entity: TerritoryEntity; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card interactive-control"
      style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 10, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
      aria-label={`Open ${entity.label}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={entity.kind === 'constraint' ? 'amber' : entity.kind === 'doctrine' ? 'success' : 'teal'}>{TERRITORY_KIND_LABELS[entity.kind]}</Badge>
        {entity.signal && <Badge tone="muted">{TERRITORY_SIGNAL_LABELS[entity.signal]}</Badge>}
        {entity.cluster && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{entity.cluster}</span>}
      </div>
      <strong style={{ display: 'block', marginTop: 8, overflowWrap: 'anywhere' }}>{entity.label}</strong>
      {entity.description && <p className="text-sm mt-1" style={{ color: 'var(--text-soft)', overflowWrap: 'anywhere' }}>{entity.description}</p>}
    </button>
  )
}

function EntityDetail({ entity, onBack, onEdit, onDelete }: {
  entity: TerritoryEntity
  onBack: () => void
  onEdit: () => void
  onDelete: () => Promise<{ ok: true } | { ok: false; error: string }>
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const remove = async () => {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    const result = await onDelete()
    setDeleting(false)
    if (!result.ok) setError(result.error)
  }
  return (
    <>
      <div className="mb-3"><ActionBtn variant="secondary" onClick={onBack}>← All territory</ActionBtn></div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={entity.kind === 'constraint' ? 'amber' : entity.kind === 'doctrine' ? 'success' : 'teal'}>{TERRITORY_KIND_LABELS[entity.kind]}</Badge>
          {entity.signal && <Badge tone="muted">{TERRITORY_SIGNAL_LABELS[entity.signal]}</Badge>}
          {entity.cluster && <Badge tone="muted">{entity.cluster}</Badge>}
        </div>
        <h3 className="font-bold mt-3" style={{ overflowWrap: 'anywhere' }}>{entity.label}</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--text-soft)', overflowWrap: 'anywhere' }}>{entity.description || UNKNOWN_LINE}</p>
        <p className="text-xs mt-3" style={{ color: 'var(--text-dim)' }}>Saved in territory_nodes · updated {when(entity.updatedAt)}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <ActionBtn variant="secondary" onClick={onEdit}>Edit entity</ActionBtn>
          <ActionBtn variant="secondary" disabled={deleting} onClick={() => void remove()}>
            {deleting ? 'Deleting…' : confirming ? 'Confirm delete' : 'Delete entity'}
          </ActionBtn>
        </div>
        {error && <HelperLine variant="error">{error}</HelperLine>}
      </Card>
    </>
  )
}

function EntityEditor({ initial, onSave, onCancel }: {
  initial: TerritoryEntity | null
  onSave: (input: TerritoryEntityInput) => Promise<{ ok: true } | { ok: false; error: string }>
  onCancel: () => void
}) {
  const [kind, setKind] = useState<TerritoryEntityKind>(initial?.kind ?? 'project')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [signal, setSignal] = useState<TerritorySignal | null>(initial?.signal ?? null)
  const [cluster, setCluster] = useState(initial?.cluster ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!label.trim()) { setError('Give the entity a name first.'); return }
    setSaving(true)
    setError('')
    const result = await onSave({ kind, label, description, signal, cluster: cluster.trim() || null })
    setSaving(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <Card className="mb-4">
      <FieldLabel>{initial ? 'Edit territory entity' : 'New territory entity'}</FieldLabel>
      <div className="grid gap-3">
        <div>
          <FieldLabel htmlFor="territory-kind">Kind</FieldLabel>
          <Select id="territory-kind" value={kind} onChange={value => setKind(value as TerritoryEntityKind)}>
            {TERRITORY_ENTITY_KINDS.map(value => <option key={value} value={value}>{TERRITORY_KIND_LABELS[value]}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="territory-label">Name</FieldLabel>
          <Input id="territory-label" value={label} onChange={setLabel} placeholder="What is this?" />
        </div>
        <div>
          <FieldLabel htmlFor="territory-description">What it is</FieldLabel>
          <Textarea id="territory-description" value={description} onChange={setDescription} rows={3} compact placeholder="Only what is saved and true." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="territory-signal">Saved signal</FieldLabel>
            <Select id="territory-signal" value={signal ?? ''} onChange={value => setSignal(value ? value as TerritorySignal : null)}>
              <option value="">No signal</option>
              {TERRITORY_SIGNALS.map(value => <option key={value} value={value}>{TERRITORY_SIGNAL_LABELS[value]}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="territory-cluster">Cluster</FieldLabel>
            <Input id="territory-cluster" value={cluster} onChange={setCluster} placeholder="e.g. Revenue" />
          </div>
        </div>
      </div>
      {error && <HelperLine variant="error">{error}</HelperLine>}
      <div className="flex flex-wrap gap-2 mt-4">
        <ActionBtn onClick={() => void submit()} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add entity'}</ActionBtn>
        <ActionBtn variant="secondary" onClick={onCancel} disabled={saving}>Cancel</ActionBtn>
      </div>
    </Card>
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
