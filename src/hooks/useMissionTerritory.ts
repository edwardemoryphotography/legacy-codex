'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { connectMissionSession, missionConnectionMessage } from '@/lib/supabase/missionSession'
import { rowToMission, type MissionRow } from '@/components/tabs/MissionTab'
import type { MissionEventLite, OpenAction } from '@/lib/territory'
import type { EvidenceLite } from '@/lib/territoryGraph'
import type { Mission } from '@/types'

export type ReadState = 'pending' | 'ok' | 'failed'

export interface MissionTerritory {
  missions: Mission[] | null
  loadError: string
  actions: OpenAction[]
  actionsRead: ReadState
  events: (MissionEventLite & { id: string })[]
  eventsRead: ReadState
  evidence: EvidenceLite[]
  evidenceRead: ReadState
  // Lessons, retirements and corrections, read on their own so older saved
  // relationships are not pushed out by newer activity.
  links: (MissionEventLite & { id: string })[]
  linksRead: ReadState
  linksTruncated: boolean
}

// Most recent events only; older history is never needed for "last activity"
// or the latest reported capacity.
const EVENT_WINDOW = 500
const LINK_TYPES = ['delta_lesson_confirmed', 'delta_lesson_retired', 'delta_corrected']
const LINK_PAGE = 1000
const LINK_PAGES = 5

// Reads the signed-in person's own missions, their unfinished actions, and
// (optionally) recent mission events — all under RLS, all read-only. A failed
// secondary read is reported as failed, never as an empty list.
export function useMissionTerritory({ withEvents = false }: { withEvents?: boolean } = {}): MissionTerritory {
  const [state, setState] = useState<MissionTerritory>({
    missions: null, loadError: '', actions: [], actionsRead: 'pending', events: [], eventsRead: withEvents ? 'pending' : 'ok', evidence: [], evidenceRead: withEvents ? 'pending' : 'ok', links: [], linksRead: withEvents ? 'pending' : 'ok', linksTruncated: false,
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
        const ev = await supabase.from('mission_events').select('id,mission_id,type,detail,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(EVENT_WINDOW)
        patch(ev.error ? { eventsRead: 'failed' } : { events: (ev.data ?? []) as MissionTerritory['events'], eventsRead: 'ok' })
        const links: MissionTerritory['links'] = []
        let linksTruncated = false
        for (let page = 0; page < LINK_PAGES; page += 1) {
          const res = await supabase.from('mission_events').select('id,mission_id,type,detail,created_at').eq('user_id', user.id).in('type', LINK_TYPES)
            .order('created_at', { ascending: false }).range(page * LINK_PAGE, page * LINK_PAGE + LINK_PAGE - 1)
          if (res.error) { links.length = 0; patch({ linksRead: 'failed' }); break }
          links.push(...((res.data ?? []) as MissionTerritory['links']))
          if ((res.data ?? []).length < LINK_PAGE) break
          linksTruncated = page === LINK_PAGES - 1
        }
        if (!cancelled) setState(prev => (prev.linksRead === 'failed' ? prev : { ...prev, links, linksRead: 'ok', linksTruncated }))
        // RLS limits this to snapshots linked to the caller's own missions.
        const snap = await supabase.from('evidence_snapshots').select('id,mission_id,kind,status,claim,observed_at').not('mission_id', 'is', null).order('observed_at', { ascending: false })
        patch(snap.error ? { evidenceRead: 'failed' } : { evidence: (snap.data ?? []) as EvidenceLite[], evidenceRead: 'ok' })
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
