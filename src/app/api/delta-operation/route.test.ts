import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number

    constructor(status = 500) {
      super('provider failure')
      this.status = status
    }
  }

  const createMessage = vi.fn()
  class FakeAnthropic {
    static APIError = FakeApiError
    messages = { create: createMessage }
  }

  return { createMessage, verifyAuth: vi.fn(), FakeApiError, FakeAnthropic }
})

vi.mock('@anthropic-ai/sdk', () => ({ default: mocks.FakeAnthropic }))
vi.mock('@supabase/server/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@supabase/server/core')>()),
  verifyAuth: mocks.verifyAuth,
}))

import { GET, POST } from './route'

function request(body: unknown, headers: HeadersInit = {}): NextRequest {
  return new NextRequest('https://preview.example.test/api/delta-operation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  missionTitle: 'Prove the Strategic Delta gives a useful recommendation',
  finishLine: 'It gives one useful recommendation, explains why, and preserves a correction',
  clause: 'It gives one useful recommendation',
  rejectedOperations: [],
}

describe('/api/delta-operation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.DELTA_OPERATION_ALLOWED_USER_ID = 'owner-1'
    // A Vercel preview's shape: only the public project URL is configured.
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_JWKS', '')
    vi.stubEnv('SUPABASE_JWKS_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://pkydkbuodikttfeawqsw.supabase.co')
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'owner-1' } }, error: null })
    mocks.createMessage.mockResolvedValue({
      content: [{ type: 'text', text: 'Reload the app and confirm the corrected recommendation remains visible.' }],
    })
  })

  it('verifies users against the public project URL when SUPABASE_URL is unset (preview shape)', async () => {
    const response = await GET(new NextRequest('https://preview.example.test/api/delta-operation'))
    expect(response.status).toBe(200)
    const options = mocks.verifyAuth.mock.calls[0][1]
    expect(options.auth).toBe('user')
    expect(options.env.url).toBe('https://pkydkbuodikttfeawqsw.supabase.co')
    expect(String(options.env.jwks)).toBe('https://pkydkbuodikttfeawqsw.supabase.co/auth/v1/.well-known/jwks.json')
  })

  it('still refuses an unauthenticated caller with 401, not a misconfiguration 500', async () => {
    mocks.verifyAuth.mockResolvedValue({ data: null, error: { status: 401, code: 'INVALID_CREDENTIALS' } })
    const response = await GET(new NextRequest('https://preview.example.test/api/delta-operation'))
    expect(response.status).toBe(401)
  })

  it('reports misconfiguration only when no project URL is set at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const response = await GET(new NextRequest('https://preview.example.test/api/delta-operation'))
    expect(response.status).toBe(500)
    expect(mocks.verifyAuth).not.toHaveBeenCalled()
  })

  it('requires an authenticated owner before reporting capability', async () => {
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'another-user' } }, error: null })

    const response = await GET(new NextRequest('https://preview.example.test/api/delta-operation'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Model-assisted candidates are not enabled for this account.' })
  })

  it('returns a concrete provider candidate only after bounded validation', async () => {
    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      operation: 'Reload the app and confirm the corrected recommendation remains visible.',
    })
    expect(mocks.createMessage).toHaveBeenCalledOnce()
  })

  it('rejects oversized input before calling the provider', async () => {
    const response = await POST(request({ ...validBody, finishLine: 'x'.repeat(2_001) }))

    expect(response.status).toBe(400)
    expect(mocks.createMessage).not.toHaveBeenCalled()
  })

  it('returns no candidate when the provider repeats a proof-target template', async () => {
    mocks.createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'Verify this part of your finish line' }] })

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ operation: null })
  })

  it('makes a provider failure explicit instead of pretending no operation was derivable', async () => {
    mocks.createMessage.mockRejectedValue(new mocks.FakeApiError(529))

    const response = await POST(request(validBody))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Model operation generation failed.' })
  })
})
