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

import { POST } from './route'

const OWNER_ID = '00000000-0000-4000-8000-000000000001'
const GUEST_ID = '00000000-0000-4000-8000-000000000002'

function request(body: unknown, token?: string): NextRequest {
  return new NextRequest('https://preview.example.test/api/brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
}

const mission = { title: 'Route test mission', state: 'active', why: 'Exercise the brief route', finishLine: null, blocker: null, capacityMismatch: false }

function directiveSent(): string {
  return createMessage.mock.calls[0][0].messages[0].content as string
}

describe('/api/brief owner gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', OWNER_ID)
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example-project.supabase.co')
    vi.stubEnv('SUPABASE_JWKS', TEST_JWKS)
    vi.stubEnv('SUPABASE_JWKS_URL', '')
    createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'Brief text.' }] })
  })

  it('denies the automatic anonymous guest with 403 before any model call', async () => {
    const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, anonymousGuestToken(GUEST_ID)))
    expect(response.status).toBe(403)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('denies a signed-in account that is not the owner with 403', async () => {
    const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, userToken(GUEST_ID)))
    expect(response.status).toBe(403)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('refuses a missing or forged session with 401, not a misconfiguration 500', async () => {
    for (const token of [undefined, forgedToken(OWNER_ID), 'not-a-jwt']) {
      const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, token))
      expect(response.status).toBe(401)
    }
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('lets the owner through to the model', async () => {
    const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ text: 'Brief text.' })
    expect(createMessage).toHaveBeenCalledOnce()
  })

  it('trims every over-length text field to 400 characters instead of rejecting', async () => {
    const long = (ch: string) => ch.repeat(1_000)
    const response = await POST(request({
      mode: 'question',
      question: long('q'),
      missions: [{ ...mission, title: long('t'), why: long('w'), finishLine: long('f'), blocker: long('b') }],
    }, userToken(OWNER_ID)))

    expect(response.status).toBe(200)
    const directive = directiveSent()
    for (const ch of ['q', 't', 'w', 'f', 'b']) {
      expect(directive).toContain(ch.repeat(400))
      expect(directive).not.toContain(ch.repeat(401))
    }
  })
})
