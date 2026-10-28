/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { GET, POST } from './route'

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
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('OPENAI_MODEL', '')
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', OWNER_ID)
    vi.stubEnv('SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example-project.supabase.co')
    vi.stubEnv('SUPABASE_JWKS', TEST_JWKS)
    vi.stubEnv('SUPABASE_JWKS_URL', '')
    createMessage.mockResolvedValue({ content: [{ type: 'text', text: 'Brief text.' }] })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

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
    expect(await response.json()).toEqual({ text: 'Brief text.', provider: 'anthropic', model: 'claude-opus-5', fallbacks: [] })
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
  it('Architect Scan sends only the chosen mission, its system prompt, and learning scoped to it', async () => {
    const id = '00000000-0000-4000-8000-0000000000aa'
    const response = await POST(request({ mode: 'architect', missions: [mission], missionIds: [id], target: { kind: 'mission' } }, userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    const call = createMessage.mock.calls[0][0]
    expect(call.system).toContain('Architect Scan')
    expect(call.messages[0].content).toContain('Intended end-state: write exactly "Intended end-state: Unknown: nothing saved yet"')
    expect(vi.mocked(loadLearnedContext).mock.calls[0][3]).toEqual([id])
  })

  it('rejects Architect Scan and Break Wall without exactly one scoped mission or a saved wall, before any model call', async () => {
    const id = '00000000-0000-4000-8000-0000000000aa'
    const bad = [
      { mode: 'architect', missions: [mission, mission], missionIds: [id, id], target: { kind: 'mission' } },
      { mode: 'architect', missions: [mission], target: { kind: 'mission' } },
      { mode: 'unblock', missions: [mission], missionIds: [id], target: { kind: 'blocker' } },
      { mode: 'unblock', missions: [mission], missionIds: [id], target: { kind: 'action', action: { title: 'x', status: 'DONE' } } },
    ]
    for (const body of bad) expect((await POST(request(body, userToken(OWNER_ID)))).status).toBe(400)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('Break Wall turns NONE into plain Unknown copy', async () => {
    createMessage.mockResolvedValueOnce({ content: [{ type: 'text', text: 'NONE' }] })
    const response = await POST(request({ mode: 'unblock', missions: [{ ...mission, blocker: 'stuck' }], missionIds: ['00000000-0000-4000-8000-0000000000aa'], target: { kind: 'blocker' } }, userToken(OWNER_ID)))
    expect((await response.json()).text).toMatch(/^Unknown: nothing saved yet/)
    expect(createMessage.mock.calls[0][0].system).toContain('30 minutes')
  })

  it('fails closed before spending on the model when saved learning cannot be read', async () => {
    vi.mocked(loadLearnedContext).mockRejectedValueOnce(new Error('Learning unavailable'))
    const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, userToken(OWNER_ID)))
    expect(response.status).toBe(503)
    expect(createMessage).not.toHaveBeenCalled()
  })

  it.each(['daily_brief', 'architect', 'unblock'])('uses OpenAI after Claude fails for %s, retaining the same scope and doctrine', async mode => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    createMessage.mockRejectedValueOnce({ status: 529 })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Fallback answer.' } }] }))
    const body = mode === 'daily_brief' ? { mode, missions: [mission] }
      : { mode, missions: [{ ...mission, blocker: 'stuck' }], missionIds: ['00000000-0000-4000-8000-0000000000aa'], target: { kind: mode === 'architect' ? 'mission' : 'blocker' } }
    const response = await POST(request(body, userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ provider: 'openai', model: 'gpt-4o', fallbacks: [{ provider: 'anthropic', reason: 'unavailable' }] })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    const options = fetchMock.mock.calls[0][1]!
    const sent = JSON.parse(options.body as string)
    expect(sent.messages[0].content).toBe(createMessage.mock.calls[0][0].system)
    expect(sent.messages[1].content).toBe(directiveSent())
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })

  it('allows OpenAI-only configuration and reports configured without exposing a key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    expect(await (await GET()).json()).toEqual({ configured: true })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'OpenAI answer.' } }] }))
    const response = await POST(request({ mode: 'daily_brief', missions: [] }, userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    expect((await response.json()).provider).toBe('openai')
    expect(createMessage).not.toHaveBeenCalled()
  })

  it.each([
    { content: [] },
    { content: [{ type: 'text', text: 'Cut off' }], stop_reason: 'max_tokens' },
  ])('falls back on empty or incomplete Claude output: %j', async result => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    createMessage.mockResolvedValueOnce(result)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'Complete answer.' } }] }))
    const response = await POST(request({ mode: 'daily_brief', missions: [] }, userToken(OWNER_ID)))
    expect(response.status).toBe(200)
    expect((await response.json()).fallbacks).toEqual([{ provider: 'anthropic', reason: 'empty or incomplete response' }])
  })

  it('does not send account data to either provider for a visitor', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const response = await POST(request({ mode: 'daily_brief', missions: [mission] }, userToken(GUEST_ID)))
    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('returns an explicit unavailable response when every provider fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    createMessage.mockRejectedValueOnce({ status: 429 })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    const response = await POST(request({ mode: 'daily_brief', missions: [] }, userToken(OWNER_ID)))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: expect.stringContaining('unavailable') })
  })

})
