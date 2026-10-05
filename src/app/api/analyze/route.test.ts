/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { TEST_JWKS, anonymousGuestToken, forgedToken, userToken } from '@/test/supabaseTestTokens'

// Only the model client is mocked. Auth runs through the real verifyAuth.
const createMessage = vi.hoisted(() => vi.fn())
vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { create: createMessage }
  },
}))

// Isolate provider-format tests from account data. No saved lesson records
// are fabricated here; this seam is not real-account learning proof.
vi.mock('@/lib/learnedContextServer', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/learnedContextServer')>()),
  loadLearnedContext: vi.fn().mockResolvedValue('No saved account data exercised by this isolated provider test.'),
}))

import { loadLearnedContext } from '@/lib/learnedContextServer'
import { POST } from './route'

const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const GUEST_ID = '00000000-0000-4000-8000-000000000002'

function request(token?: string, instruction = 'Summarize this.'): NextRequest {
  const form = new FormData()
  form.set('instruction', instruction)
  form.append('files', new File(['route test artifact'], 'artifact.txt', { type: 'text/plain' }))
  return new NextRequest('https://preview.example.test/api/analyze', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
}

describe('/api/analyze owner gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', OWNER_ID)
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example-project.supabase.co')
    vi.stubEnv('SUPABASE_JWKS', TEST_JWKS)
    vi.stubEnv('SUPABASE_JWKS_URL', '')
    createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'Analysis text.' }] })
  })

  it('denies the automatic anonymous guest with 403 before any model call', async () => {
    const response = await POST(request(anonymousGuestToken(GUEST_ID)))
    expect(response.status).toBe(403)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('refuses a missing or forged session with 401, not a misconfiguration 500', async () => {
    for (const token of [undefined, forgedToken(OWNER_ID)]) {
      const response = await POST(request(token))
      expect(response.status).toBe(401)
    }
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('reports 500 only when no Supabase project URL is configured at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const response = await POST(request(userToken(OWNER_ID)))
    expect(response.status).toBe(500)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('lets the owner through to the model', async () => {
    const response = await POST(request(userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'Analysis text.' })
    expect(createMessage).toHaveBeenCalledOnce()
  })

  it('trims an over-length directive to 400 characters instead of rejecting', async () => {
    const response = await POST(request(userToken(OWNER_ID), 'd'.repeat(1_000)))
    expect(response.status).toBe(200)
    const content = createMessage.mock.calls[0][0].messages[0].content as Array<{ type: string; text?: string }>
    const directive = content[content.length - 2].text ?? ''
    expect(directive).toBe('d'.repeat(400))
  })
  it('fails closed before spending on the model when saved learning cannot be read', async () => {
    vi.mocked(loadLearnedContext).mockRejectedValueOnce(new Error('Learning unavailable'))
    const response = await POST(request(userToken(OWNER_ID)))
    expect(response.status).toBe(503)
    expect(createMessage).not.toHaveBeenCalled()
  })

})
