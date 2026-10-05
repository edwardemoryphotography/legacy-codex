/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  loadConfirmedLessons: vi.fn(),
  loadRouteLearning: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@supabase/server/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@supabase/server/core')>()),
  verifyAuth: mocks.verifyAuth,
}))
vi.mock('@/lib/projectReviewServer', () => ({ projectUserClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/projectLessonsServer', () => ({ loadConfirmedLessons: mocks.loadConfirmedLessons }))
vi.mock('@/lib/routeLearningServer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/routeLearningServer')>()),
  loadRouteLearning: mocks.loadRouteLearning,
}))

import { GET } from './route'

const CURRENT_MISSION = '22222222-2222-4222-8222-222222222222'
const CORRECTION_MISSION = '11111111-1111-4111-8111-111111111111'
const CORRECTION_ID = '33333333-3333-4333-8333-333333333333'

describe('/api/task-routing pending correction reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://pkydkbuodikttfeawqsw.supabase.co')
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'user-1' } }, error: null })
    mocks.loadConfirmedLessons.mockResolvedValue([])
    mocks.loadRouteLearning.mockResolvedValue({})
    mocks.from.mockImplementation((table: string) => {
      const filters: Array<[string, unknown]> = []
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query }),
        single: vi.fn(async () => ({ data: { id: CURRENT_MISSION }, error: null })),
        maybeSingle: vi.fn(async () => ({
          data: table === 'mission_events' && filters.some(([key, value]) => key === 'mission_id' && value === CORRECTION_MISSION) ? { id: 'event-1' } : null,
          error: null,
        })),
      }
      return query
    })
  })

  it('acknowledges a pending correction against its original mission while another mission is visible', async () => {
    const request = new NextRequest(`https://preview.example.test/api/task-routing?missionId=${CURRENT_MISSION}&correctionId=${CORRECTION_ID}&correctionMissionId=${CORRECTION_MISSION}`, {
      headers: { Authorization: 'Bearer token' },
    })

    const response = await GET(request)

    if (!response) throw new Error('Expected task-routing response.')
    expect(response.status).toBe(200)
    expect((await response.json()).savedCorrectionId).toBe(CORRECTION_ID)
  })
})
