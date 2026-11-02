import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encodeLessonRelay } from '@/lib/lessonRelay'

const mocks = vi.hoisted(() => ({ insert: vi.fn(async () => ({ error: null })) }))
vi.mock('@/lib/supabase/deltaAuth', () => ({ deltaUser: async () => ({ userId: 'test-user', url: 'https://example.test' }) }))
vi.mock('@/lib/projectReviewServer', () => ({
  projectUserClient: () => ({
    from: (table: string) => table === 'missions'
      ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: '00000000-0000-4000-8000-000000000000' }, error: null }) }) }) }) }
      : { insert: mocks.insert },
  }),
}))
import { POST } from './route'

describe('lesson relay request bounds', () => {
  it.each(['界', '\u0001'])('accepts the full encoded link for maximum-size text', async character => {
    const code = encodeLessonRelay({ rule: character.repeat(1000), whenToApply: character.repeat(500) })
    const request = new NextRequest('https://legacy-codex.vercel.app/api/lesson-relay', {
      method: 'POST', body: JSON.stringify({ action: 'receive', code: `https://legacy-codex.vercel.app/?relay=${code}`, missionId: '00000000-0000-4000-8000-000000000000', scope: 'mission' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ received: true })
  })

  it('rejects an oversized request', async () => {
    const response = await POST(new NextRequest('https://legacy-codex.vercel.app/api/lesson-relay', { method: 'POST', body: 'x'.repeat(20_000) }))
    expect(response.status).toBe(413)
  })
})
