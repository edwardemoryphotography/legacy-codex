// Pure view-model for the Territory tab: groups the person's own saved
// missions and derives Active State from existing data only. No I/O, no
// clock, nothing inferred — an empty field stays empty.
import type { Mission, MissionState } from '@/types'

// The one unfinished saved action per mission (unique index in
// 20260906002630_enforce_one_unfinished_mission_action.sql).
export interface OpenAction {
  id: string
  mission_id: string
  action_title: string
  status: string
  resume_note: string | null
  updated_at?: string
}

export interface MissionEventLite {
  mission_id: string
  type: string
  detail: string
  created_at: string
}

export type TerritoryGroup = 'active' | 'paused' | 'completed' | 'abandoned'

// Four groups for scanning; every card still shows its real saved state, so
// "active" never hides that a mission is blocked or only a candidate.
export const GROUP_OF_STATE: Record<MissionState, TerritoryGroup> = {
  primary: 'active',
  secondary: 'active',
  blocked: 'active',
  candidate: 'active',
  paused: 'paused',
  parked: 'paused',
  completed: 'completed',
  abandoned: 'abandoned',
}

export const GROUP_LABELS: Record<TerritoryGroup, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

const GROUP_ORDER: TerritoryGroup[] = ['active', 'paused', 'completed', 'abandoned']

// Latest saved change across the mission row, its unfinished action, and its
// events in the read window. Never later than anything actually saved.
export function lastActivity(mission: Mission, action: OpenAction | null, events: MissionEventLite[]): string {
  const stamps = [mission.updatedAt, action?.updated_at, ...events.filter(e => e.mission_id === mission.id).map(e => e.created_at)]
  return stamps.filter((s): s is string => Boolean(s)).reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
}

export interface TerritoryCard {
  mission: Mission
  action: OpenAction | null
  lastActivity: string
}

export function groupTerritory(missions: Mission[], actions: OpenAction[], events: MissionEventLite[]) {
  const cards: TerritoryCard[] = missions.map(mission => {
    const action = actions.find(a => a.mission_id === mission.id) ?? null
    return { mission, action, lastActivity: lastActivity(mission, action, events) }
  })
  return GROUP_ORDER.map(group => ({
    group,
    cards: cards.filter(c => GROUP_OF_STATE[c.mission.state] === group).sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity)),
  })).filter(g => g.cards.length > 0)
}

// Mission writes "reported capacity: <level>" in the detail of
// capacity_mismatch_reported (missionLoop.reportCapacityMismatch).
export function reportedCapacity(missionId: string, events: MissionEventLite[]): { level: string; at: string } | null {
  const latest = events
    .filter(e => e.mission_id === missionId && e.type === 'capacity_mismatch_reported')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
  const level = latest?.detail.match(/^reported capacity: (\w+)/)?.[1]
  return latest && level ? { level, at: latest.created_at } : null
}

export interface ActiveState {
  primary: Mission | null
  // Mission's existing low-capacity rule: once a mismatch is reported against
  // the Primary, the Secondary is the actionable mission (spec §5).
  capacity: { mismatch: boolean; reported: { level: string; at: string } | null; secondary: Mission | null }
  nextSafeAction: OpenAction | null
}

export function activeState(missions: Mission[], actions: OpenAction[], events: MissionEventLite[]): ActiveState {
  const primary = missions.find(m => m.state === 'primary') ?? null
  return {
    primary,
    capacity: {
      mismatch: Boolean(primary?.capacityMismatch),
      reported: primary ? reportedCapacity(primary.id, events) : null,
      secondary: missions.find(m => m.state === 'secondary') ?? null,
    },
    nextSafeAction: primary ? actions.find(a => a.mission_id === primary.id) ?? null : null,
  }
}
