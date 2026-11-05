'use client'

import { useEffect, useMemo, useState } from 'react'
import { missionsToBriefContext } from '@/lib/dailyBrief'
import { ActionBtn, Badge, Card, FieldLabel, HelperLine, Input, Select, Textarea } from '@/components/ui'
import type { TerritoryEntity } from '@/lib/territoryEntities'
import { TERRITORY_ENERGIES, TERRITORY_ENERGY_LABELS, type TerritoryEnergy, type TerritoryLink } from '@/lib/territoryWorkspace'
import type { TerritoryWorkspace } from '@/hooks/useTerritoryWorkspace'
import type { Mission } from '@/types'

type Option = { value: string; label: string; kind: 'mission' | 'territory_node'; id: string }

function optionLabel(option: Option) { return `${option.kind === 'mission' ? 'Mission' : 'Territory'} · ${option.label || 'Untitled'}` }

function eventLabel(event: { type: string; created_at?: string; createdAt?: string }) {
  return event.type.replace(/_/g, ' ')
}

export default function TerritoryWorkspacePanel({ missions, entities, workspace, brief }: {
  missions: Mission[]
  entities: TerritoryEntity[]
  workspace: TerritoryWorkspace
  brief: ReturnType<typeof import('@/hooks/useBriefRunner').useBriefRunner>
}) {
  const options = useMemo<Option[]>(() => [
    ...missions.map(mission => ({ value: `mission:${mission.id}`, label: mission.title || 'Untitled mission', kind: 'mission' as const, id: mission.id })),
    ...entities.map(entity => ({ value: `node:${entity.id}`, label: entity.label, kind: 'territory_node' as const, id: entity.id })),
  ], [missions, entities])
  const byValue = useMemo(() => new Map(options.map(option => [option.value, option])), [options])
  const [project, setProject] = useState(workspace.state?.activeProject ?? '')
  const [energy, setEnergy] = useState<TerritoryEnergy | null>(workspace.state?.energy ?? null)
  const [nextAction, setNextAction] = useState(workspace.state?.nextAction ?? '')
  const [stateMessage, setStateMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [from, setFrom] = useState(options[0]?.value ?? '')
  const [to, setTo] = useState(options[1]?.value ?? '')
  const [relation, setRelation] = useState('relates to')
  const [linkMessage, setLinkMessage] = useState('')
  const [logText, setLogText] = useState('')
  const [logMessage, setLogMessage] = useState('')
  const [question, setQuestion] = useState('')

  useEffect(() => {
    setProject(workspace.state?.activeProject ?? '')
    setEnergy(workspace.state?.energy ?? null)
    setNextAction(workspace.state?.nextAction ?? '')
  }, [workspace.state?.updatedAt])
  useEffect(() => {
    if (!from && options[0]) setFrom(options[0].value)
    if (!to && options[1]) setTo(options[1].value)
  }, [options, from, to])

  const saveState = async () => {
    setSaving(true)
    const result = await workspace.saveState({ activeProject: project, energy, nextAction })
    setSaving(false)
    setStateMessage(result.ok ? 'Saved.' : result.error)
  }
  const addLink = async () => {
    const a = byValue.get(from)
    const b = byValue.get(to)
    if (!a || !b) { setLinkMessage('Choose two saved things first.'); return }
    if (a.kind === b.kind && a.id === b.id) { setLinkMessage('Choose two different saved things.'); return }
    if (!relation.trim()) { setLinkMessage('Name the relationship first.'); return }
    const result = await workspace.createLink({ fromKind: a.kind, fromId: a.id, toKind: b.kind, toId: b.id, relation, fromLabel: a.label, toLabel: b.label })
    setLinkMessage(result.ok ? 'Connection saved.' : result.error)
  }
  const removeLink = async (link: TerritoryLink) => {
    const a = byValue.get(`${link.fromKind === 'mission' ? 'mission' : 'node'}:${link.fromId}`)
    const b = byValue.get(`${link.toKind === 'mission' ? 'mission' : 'node'}:${link.toId}`)
    const result = await workspace.removeLink(link, { fromLabel: a?.label, toLabel: b?.label })
    if (!result.ok) setLinkMessage(result.error)
  }
  const addLog = async () => {
    const result = await workspace.addLog(logText)
    setLogMessage(result.ok ? 'Logged.' : result.error)
    if (result.ok) setLogText('')
  }
  const exportWorkspace = () => {
    const payload = { exportedAt: new Date().toISOString(), state: workspace.state, links: workspace.links, events: workspace.events }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `legacy-codex-territory-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const ask = () => {
    const q = question.trim()
    if (!q) return
    void brief.run('question', {
      mode: 'question',
      question: q,
      missions: missionsToBriefContext(missions),
      missionIds: missions.slice(0, 40).map(mission => mission.id),
    }, 'Territory question')
  }

  if (workspace.stateRead === 'failed' || workspace.linksRead === 'failed' || workspace.eventsRead === 'failed') {
    return <HelperLine variant="error">{workspace.error || 'The territory workspace could not be read right now. Nothing was changed.'}</HelperLine>
  }

  return (
    <div className="grid gap-4 mb-5 md:grid-cols-2">
      <Card>
        <FieldLabel>Active state</FieldLabel>
        <div className="grid gap-3">
          <div>
            <FieldLabel htmlFor="territory-project">Current project</FieldLabel>
            <Input id="territory-project" value={project} onChange={setProject} placeholder="What are you actually working on?" />
          </div>
          <div>
            <FieldLabel>Energy</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TERRITORY_ENERGIES.map(value => (
                <ActionBtn key={value} variant={energy === value ? 'primary' : 'secondary'} onClick={() => setEnergy(energy === value ? null : value)}>
                  {TERRITORY_ENERGY_LABELS[value]}
                </ActionBtn>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="territory-next-action">Next safe action</FieldLabel>
            <Input id="territory-next-action" value={nextAction} onChange={setNextAction} placeholder="One concrete move" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <ActionBtn onClick={() => void saveState()} disabled={saving}>{saving ? 'Saving…' : 'Save state'}</ActionBtn>
          {workspace.state?.updatedAt && <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Saved {new Date(workspace.state.updatedAt).toLocaleString()}</span>}
        </div>
        {stateMessage && <HelperLine>{stateMessage}</HelperLine>}
      </Card>

      <Card>
        <FieldLabel>Connections</FieldLabel>
        <p className="text-sm mb-3" style={{ color: 'var(--text-soft)' }}>Saved relationships between missions and the projects, doctrine or constraints they live inside.</p>
        <div className="grid gap-3 mb-3">
          <div>
            <FieldLabel htmlFor="territory-link-from">From</FieldLabel>
            <Select id="territory-link-from" value={from} onChange={setFrom}>{options.map(option => <option key={option.value} value={option.value}>{optionLabel(option)}</option>)}</Select>
          </div>
          <div>
            <FieldLabel htmlFor="territory-link-relation">Relationship</FieldLabel>
            <Input id="territory-link-relation" value={relation} onChange={setRelation} placeholder="e.g. serves, constrains, proves" />
          </div>
          <div>
            <FieldLabel htmlFor="territory-link-to">To</FieldLabel>
            <Select id="territory-link-to" value={to} onChange={setTo}>{options.map(option => <option key={option.value} value={option.value}>{optionLabel(option)}</option>)}</Select>
          </div>
          <ActionBtn variant="secondary" onClick={() => void addLink()} disabled={options.length < 2}>Save connection</ActionBtn>
        </div>
        {workspace.links.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No saved connections yet.</p> : (
          <ul className="text-sm" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {workspace.links.map(link => {
              const a = byValue.get(`${link.fromKind === 'mission' ? 'mission' : 'node'}:${link.fromId}`)
              const b = byValue.get(`${link.toKind === 'mission' ? 'mission' : 'node'}:${link.toId}`)
              return <li key={link.id} style={{ overflowWrap: 'anywhere' }}>
                <strong>{a?.label ?? 'Missing'}</strong> <span style={{ color: 'var(--text-dim)' }}>— {link.relation} →</span> <strong>{b?.label ?? 'Missing'}</strong>{' '}
                <button type="button" className="underline" style={{ color: 'var(--error)', minHeight: 44 }} onClick={() => void removeLink(link)}>Remove</button>
              </li>
            })}
          </ul>
        )}
        {linkMessage && <HelperLine>{linkMessage}</HelperLine>}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-2">
          <FieldLabel>State log</FieldLabel>
          <button type="button" className="glass-chip glass" style={{ minHeight: 36 }} onClick={exportWorkspace}>Export</button>
        </div>
        <div className="flex gap-2 mb-2">
          <Input value={logText} onChange={setLogText} placeholder="What changed?" />
          <ActionBtn variant="secondary" onClick={() => void addLog()}>Log</ActionBtn>
        </div>
        {logMessage && <HelperLine>{logMessage}</HelperLine>}
        {workspace.events.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No entries yet.</p> : (
          <ul className="text-sm" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {workspace.events.slice(0, 6).map(event => <li key={event.id} style={{ overflowWrap: 'anywhere' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{new Date(event.createdAt).toLocaleString()} · {eventLabel(event)}</span>
              <div>{event.detail.length > 180 ? <details><summary style={{ cursor: 'pointer' }}>{event.detail.slice(0, 180)}… show all</summary><div style={{ marginTop: 4 }}>{event.detail}</div></details> : event.detail}</div>
            </li>)}
          </ul>
        )}
      </Card>

      <Card>
        <FieldLabel>Ask about this territory</FieldLabel>
        <p className="text-sm mb-2" style={{ color: 'var(--text-soft)' }}>Uses the existing owner-gated Brief path over saved missions. Nothing is saved by asking.</p>
        <Textarea value={question} onChange={setQuestion} rows={3} compact placeholder="What connects this work? What should I do next?" />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <ActionBtn onClick={ask} disabled={brief.status === 'running' || !brief.configured || brief.visitor || !question.trim()}>{brief.status === 'running' ? 'Thinking…' : 'Ask'}</ActionBtn>
          {brief.visitor && <Badge tone="amber">Sign in for AI</Badge>}
        </div>
      </Card>
    </div>
  )
}
