'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession, missionConnectionMessage } from '@/lib/supabase/missionSession'
import { rowToMission, type MissionRow } from '@/components/tabs/MissionTab'
import type { MissionEventLite, OpenAction } from '@/lib/territory'
import type { Mission } from '@/types'

export type ReadState = 'pending' | 'ok' | 'failed'

export interface MissionTerritory {
  missions: Mission[] | null
  loadError: string
  actions: OpenAction[]
  actionsRead: ReadState
  events: MissionEventLite[]
  eventsRead: ReadState
}

// Most recent events only; older history is never needed for "last activity"
// or the latest reported capacity.
const EVENT_WINDOW = 500

// Reads the signed-in person's own missions, their unfinished actions, and
// (optionally) recent mission events — all under RLS, all read-only. A failed
// secondary read is reported as failed, never as an empty list.
export function useMissionTerritory({ withEvents = false }: { withEvents?: boolean } = {}): MissionTerritory {
  const [state, setState] = useState<MissionTerritory>({
    missions: null, loadError: '', actions: [], actionsRead: 'pending', events: [], eventsRead: withEvents ? 'pending' : 'ok',
  })

  useEffect(() => {
    let cancelled = false
    const patch = (next: Partial<MissionTerritory>) => { if (!cancelled) setState(prev => ({ ...prev, ...next })) }
    async function load() {
      try {
        const user = await connectMissionSession()
        if (cancelled) return
        const { data, error } = await supabase.from('missions').select('*').eq('user_id', user.id)
        if (error) throw error
        patch({ missions: ((data ?? []) as MissionRow[]).map(rowToMission) })
        const open = await supabase.from('actions').select('id,mission_id,action_title,status,resume_note,updated_at').not('mission_id', 'is', null).neq('status', 'DONE')
        patch(open.error ? { actionsRead: 'failed' } : { actions: (open.data ?? []) as OpenAction[], actionsRead: 'ok' })
        if (!withEvents) return
        const ev = await supabase.from('mission_events').select('mission_id,type,detail,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(EVENT_WINDOW)
        patch(ev.error ? { eventsRead: 'failed' } : { events: (ev.data ?? []) as MissionEventLite[], eventsRead: 'ok' })
      } catch (err) {
        patch({ loadError: missionConnectionMessage(err) })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [withEvents])

  return state
}
