'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'
import {
  rowToTerritoryEvent,
  rowToTerritoryLink,
  rowToTerritoryState,
  type TerritoryEndpointKind,
  type TerritoryEvent,
  type TerritoryEventRow,
  type TerritoryLink,
  type TerritoryLinkInput,
  type TerritoryLinkRow,
  type TerritoryState,
  type TerritoryStateRow,
  type TerritoryEnergy,
  TERRITORY_ENERGY_LABELS,
} from '@/lib/territoryWorkspace'

export type TerritoryWorkspaceReadState = 'pending' | 'ok' | 'failed'
export const TERRITORY_WORKSPACE_READ_FAILED_COPY = 'The territory workspace could not be read right now. Nothing was changed.'

interface State {
  links: TerritoryLink[]
  linksRead: TerritoryWorkspaceReadState
  state: TerritoryState | null
  stateRead: TerritoryWorkspaceReadState
  events: TerritoryEvent[]
  eventsRead: TerritoryWorkspaceReadState
  error: string
}

type Write = { ok: true } | { ok: false; error: string }

function fail(action: string): { ok: false; error: string } {
  return { ok: false, error: `Could not ${action}. Nothing was changed.` }
}

export function useTerritoryWorkspace(refreshKey = 0) {
  const [data, setData] = useState<State>({ links: [], linksRead: 'pending', state: null, stateRead: 'pending', events: [], eventsRead: 'pending', error: '' })

  useEffect(() => {
    let cancelled = false
    setData({ links: [], linksRead: 'pending', state: null, stateRead: 'pending', events: [], eventsRead: 'pending', error: '' })
    async function load() {
      try {
        const user = await connectMissionSession()
        const [links, state, events] = await Promise.all([
          supabase.from('territory_links').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.from('territory_state').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('territory_events').select('id,type,detail,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        ])
        if (cancelled) return
        setData({
          links: links.error ? [] : ((links.data ?? []) as TerritoryLinkRow[]).map(rowToTerritoryLink),
          linksRead: links.error ? 'failed' : 'ok',
          state: state.error || !state.data ? null : rowToTerritoryState(state.data as TerritoryStateRow),
          stateRead: state.error ? 'failed' : 'ok',
          events: events.error ? [] : ((events.data ?? []) as TerritoryEventRow[]).map(rowToTerritoryEvent),
          eventsRead: events.error ? 'failed' : 'ok',
          error: links.error || state.error || events.error ? TERRITORY_WORKSPACE_READ_FAILED_COPY : '',
        })
      } catch {
        if (!cancelled) setData(prev => ({ ...prev, linksRead: 'failed', stateRead: 'failed', eventsRead: 'failed', error: TERRITORY_WORKSPACE_READ_FAILED_COPY }))
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshKey])

  async function record(type: TerritoryEvent['type'], detail: string) {
    try {
      const user = await connectMissionSession()
      const { data: row, error } = await supabase.from('territory_events').insert({ user_id: user.id, type, detail })
        .select('id,type,detail,created_at').single()
      if (error || !row) throw error
      setData(prev => ({ ...prev, events: [rowToTerritoryEvent(row as TerritoryEventRow), ...prev.events].slice(0, 100), eventsRead: 'ok' }))
    } catch { /* the primary write already succeeded; the log remains explicit */ }
  }

  async function createLink(input: TerritoryLinkInput): Promise<Write> {
    try {
      const user = await connectMissionSession()
      const { data: row, error } = await supabase.from('territory_links').insert({
        user_id: user.id,
        from_kind: input.fromKind,
        from_id: input.fromId,
        to_kind: input.toKind,
        to_id: input.toId,
        relation: input.relation.trim(),
        provenance: 'person',
      }).select('*').single()
      if (error || !row) throw error
      const link = rowToTerritoryLink(row as TerritoryLinkRow)
      setData(prev => ({ ...prev, links: [...prev.links, link], linksRead: 'ok' }))
      await record('link_created', `${input.fromLabel ?? link.fromId} → ${input.toLabel ?? link.toId} · ${link.relation}`)
      return { ok: true }
    } catch { return fail('save that connection') }
  }

  async function removeLink(link: TerritoryLink, labels?: { fromLabel?: string; toLabel?: string }): Promise<Write> {
    try {
      const user = await connectMissionSession()
      const { error } = await supabase.from('territory_links').delete().eq('id', link.id).eq('user_id', user.id)
      if (error) throw error
      setData(prev => ({ ...prev, links: prev.links.filter(item => item.id !== link.id), linksRead: 'ok' }))
      await record('link_removed', `${labels?.fromLabel ?? link.fromId} → ${labels?.toLabel ?? link.toId} · ${link.relation}`)
      return { ok: true }
    } catch { return fail('remove that connection') }
  }

  async function saveState(input: { activeProject: string | null; energy: TerritoryEnergy | null; nextAction: string | null }): Promise<Write> {
    try {
      const user = await connectMissionSession()
      const { data: row, error } = await supabase.from('territory_state').upsert({
        user_id: user.id,
        active_project: input.activeProject?.trim() || null,
        energy: input.energy,
        next_action: input.nextAction?.trim() || null,
      }, { onConflict: 'user_id' }).select('*').single()
      if (error || !row) throw error
      setData(prev => ({ ...prev, state: rowToTerritoryState(row as TerritoryStateRow), stateRead: 'ok' }))
      await record('state_saved', [input.activeProject, input.energy ? TERRITORY_ENERGY_LABELS[input.energy] : null, input.nextAction].filter(Boolean).join(' · ') || 'State cleared')
      return { ok: true }
    } catch { return fail('save the active state') }
  }

  async function addLog(detail: string): Promise<Write> {
    if (!detail.trim()) return { ok: false, error: 'Write a note before logging it.' }
    try {
      const user = await connectMissionSession()
      const { data: row, error } = await supabase.from('territory_events').insert({ user_id: user.id, type: 'log_entry', detail: detail.trim() })
        .select('id,type,detail,created_at').single()
      if (error || !row) throw error
      setData(prev => ({ ...prev, events: [rowToTerritoryEvent(row as TerritoryEventRow), ...prev.events].slice(0, 100), eventsRead: 'ok' }))
      return { ok: true }
    } catch { return fail('save that log entry') }
  }

  return { ...data, createLink, removeLink, saveState, addLog }
}

export type TerritoryWorkspace = ReturnType<typeof useTerritoryWorkspace>
export type TerritoryEndpoint = { kind: TerritoryEndpointKind; id: string }
