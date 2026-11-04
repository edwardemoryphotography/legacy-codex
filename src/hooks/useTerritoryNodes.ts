'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession } from '@/lib/supabase/missionSession'
import {
  rowToTerritoryEntity,
  sortTerritoryEntities,
  type TerritoryEntity,
  type TerritoryEntityInput,
  type TerritoryNodeRow,
} from '@/lib/territoryEntities'

export type TerritoryNodesReadState = 'pending' | 'ok' | 'failed'

export const TERRITORY_NODES_READ_FAILED_COPY = 'Territory entities could not be read right now. Nothing was changed.'

interface TerritoryNodesState {
  nodes: TerritoryEntity[] | null
  readState: TerritoryNodesReadState
  error: string
}

type WriteResult = { ok: true; entity: TerritoryEntity } | { ok: false; error: string }

function writeError(action: string): string {
  return `Could not ${action} this territory entity. Nothing was changed.`
}

export function useTerritoryNodes(refreshKey = 0) {
  const [state, setState] = useState<TerritoryNodesState>({ nodes: null, readState: 'pending', error: '' })

  useEffect(() => {
    let cancelled = false
    setState({ nodes: null, readState: 'pending', error: '' })
    async function load() {
      try {
        const user = await connectMissionSession()
        const { data, error } = await supabase.from('territory_nodes').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        if (error) throw error
        if (!cancelled) setState({ nodes: sortTerritoryEntities(((data ?? []) as TerritoryNodeRow[]).map(rowToTerritoryEntity)), readState: 'ok', error: '' })
      } catch {
        if (!cancelled) setState({ nodes: null, readState: 'failed', error: TERRITORY_NODES_READ_FAILED_COPY })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [refreshKey])

  async function create(input: TerritoryEntityInput): Promise<WriteResult> {
    try {
      const user = await connectMissionSession()
      const { data, error } = await supabase.from('territory_nodes').insert({
        user_id: user.id,
        kind: input.kind,
        label: input.label.trim(),
        description: input.description.trim(),
        signal: input.signal,
        cluster: input.cluster?.trim() || null,
      }).select('*').single()
      if (error || !data) throw error ?? new Error('No territory entity returned')
      const entity = rowToTerritoryEntity(data as TerritoryNodeRow)
      setState(prev => ({ nodes: sortTerritoryEntities([entity, ...(prev.nodes ?? [])]), readState: 'ok', error: '' }))
      return { ok: true, entity }
    } catch {
      return { ok: false, error: writeError('save') }
    }
  }

  async function update(id: string, input: TerritoryEntityInput): Promise<WriteResult> {
    try {
      const user = await connectMissionSession()
      const { data, error } = await supabase.from('territory_nodes').update({
        kind: input.kind,
        label: input.label.trim(),
        description: input.description.trim(),
        signal: input.signal,
        cluster: input.cluster?.trim() || null,
      }).eq('id', id).eq('user_id', user.id).select('*').single()
      if (error || !data) throw error ?? new Error('No territory entity returned')
      const entity = rowToTerritoryEntity(data as TerritoryNodeRow)
      setState(prev => ({ nodes: sortTerritoryEntities((prev.nodes ?? []).map(node => node.id === id ? entity : node)), readState: 'ok', error: '' }))
      return { ok: true, entity }
    } catch {
      return { ok: false, error: writeError('update') }
    }
  }

  async function remove(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const user = await connectMissionSession()
      const { error } = await supabase.from('territory_nodes').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
      setState(prev => ({ nodes: (prev.nodes ?? []).filter(node => node.id !== id), readState: 'ok', error: '' }))
      return { ok: true }
    } catch {
      return { ok: false, error: writeError('delete') }
    }
  }

  return { ...state, create, update, remove }
}
