import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Mission } from '@/types'
import type { MissionTerritory } from '@/hooks/useMissionTerritory'
import { deriveHomeContinue } from '@/lib/homeContinue'
import { deriveNextAction } from '@/lib/nextAction'
import HomeStrategicDecision from './HomeStrategicDecision'

vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

const mission: Mission = {
  id: 'm1', title: 'Ship the print store', why: 'It pays for the next shoot.',
  finishLine: 'One print sold to a stranger', evidenceRequirement: null, state: 'primary',
  blocker: null, capacityMismatch: false, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
}
const saved = { id: 'a1', missionId: 'm1', title: 'Upload three prints', status: 'IN_PROGRESS' as const }

function viewFor(target: Mission) {
  const nextAction = deriveNextAction({ readState: 'loaded', mission: target, delta: null, savedAction: saved, acceptance: null })
  return deriveHomeContinue({ readState: 'loaded', missionCount: 1, mission: target, nextAction, correctionCount: null, activeLessonCount: null })
}

function renderDecision(target: Mission, onOpen = vi.fn()) {
  const territory = { accountId: 'acc', missions: [target], evidence: [], links: [], events: [] } as unknown as MissionTerritory
  render(<HomeStrategicDecision
    territory={territory} mission={target} saved={saved} view={viewFor(target)}
    allowReview={false} onOpen={onOpen} onChange={() => {}} onReviewActivity={() => {}}
  />)
  return onOpen
}

describe('HomeStrategicDecision resume visibility', () => {
  it('keeps a direct Resume when the recommendation differs from the saved step', () => {
    const overCapacity = { ...mission, capacityMismatch: true }
    const onOpen = renderDecision(overCapacity)

    const resume = screen.getByRole('button', { name: 'Resume your saved step' })
    fireEvent.click(resume)
    // One tap goes to the saved action itself, not just the top of Mission.
    expect(onOpen).toHaveBeenCalledWith(true)
  })

  it('does not duplicate Resume when the saved step already leads', () => {
    renderDecision(mission)
    expect(screen.queryByRole('button', { name: 'Resume your saved step' })).toBeNull()
  })
})
