import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The review step constructs an Anthropic client directly, so the provider
// boundary is mocked here. This exercises the request contract and response
// acceptance only: no model, network, account or saved lesson is involved.
const mocks = vi.hoisted(() => {
  const createMessage = vi.fn()
  class FakeApiError extends Error {
    status: number

    constructor(status = 500) {
      super('provider failure')
      this.status = status
    }
  }
  class FakeAnthropic {
    static APIError = FakeApiError
    messages = { create: createMessage }
  }
  return { createMessage, FakeAnthropic }
})

vi.mock('@anthropic-ai/sdk', () => ({ default: mocks.FakeAnthropic }))

import { runProviderChainReviewStep } from './modelProviderChain'

const TOOL = {
  name: 'submit_project_review',
  description: 'Return the reviewed proposal.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      decision: { type: 'string', enum: ['act', 'resume', 'clarify'] },
      operation: { type: 'string', maxLength: 240 },
    },
    required: ['decision', 'operation'],
  },
}

function request(requireToolOutput = true) {
  return {
    system: 'system',
    userContent: 'context',
    maxTokens: 1_000,
    requireToolOutput,
    tool: TOOL,
  }
}

describe('runProviderChainReviewStep', () => {
  beforeEach(() => {
    mocks.createMessage.mockReset()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses automatic tool choice, which Claude Opus 5.5 supports', async () => {
    // Opus 5.5 returns HTTP 400 for `tool_choice` "tool" and "any", so this is
    // a compatibility guard, not a style preference: never force the tool.
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: TOOL.name, input: { decision: 'act', operation: 'Ship it' } }],
    })

    await runProviderChainReviewStep(request())

    const payload = mocks.createMessage.mock.calls[0]?.[0] as { tool_choice?: { type?: string } }
    expect(payload.tool_choice?.type).toBe('auto')
    expect(['tool', 'any']).not.toContain(payload.tool_choice?.type)
  })

  it('accepts one matching tool_use block', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: TOOL.name, input: { decision: 'act', operation: 'Ship it' } }],
    })

    const result = await runProviderChainReviewStep(request())
    expect(result).toMatchObject({ stopReason: 'tool_use', provider: 'anthropic', toolInput: { decision: 'act' } })
  })

  it('accepts schema-shaped JSON when the model answers in text', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Final answer:\n```json\n{"decision":"act","operation":"Ship it"}\n```' }],
    })

    const result = await runProviderChainReviewStep(request())
    expect(result).toMatchObject({
      stopReason: 'structured_text',
      provider: 'anthropic',
      toolInput: { decision: 'act', operation: 'Ship it' },
    })
  })

  it('ignores thinking blocks when selecting text', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '' },
        { type: 'text', text: '{"decision":"resume","operation":"Continue the saved step"}' },
      ],
    })

    const result = await runProviderChainReviewStep(request())
    expect(result.stopReason).toBe('structured_text')
  })

  it('rejects prose that carries no schema-shaped JSON', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here is my review: do the next thing.' }],
    })

    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })

  it('rejects JSON that is missing required schema keys', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"decision":"act"}' }],
    })

    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })

  it('sends no tools and returns text when tool output is not required', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'A bounded comparison.' }],
    })

    const result = await runProviderChainReviewStep(request(false))
    expect(result).toMatchObject({ stopReason: 'end_turn', text: 'A bounded comparison.', provider: 'anthropic' })
    const payload = mocks.createMessage.mock.calls[0]?.[0] as { tools?: unknown; tool_choice?: unknown }
    expect(payload.tools).toBeUndefined()
    expect(payload.tool_choice).toBeUndefined()
  })

  it('rejects JSON whose field types or enum are wrong', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"decision":"invent","operation":"Ship it"}' }],
    })
    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })

  it('rejects a tool_use block that violates the schema', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: TOOL.name, input: { decision: 'act', operation: 'x', extra: true } }],
    })
    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })

  it('falls back to the next provider when Anthropic rejects the request', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'openai-test-key')
    mocks.createMessage.mockRejectedValue(Object.assign(new Error('400'), { status: 400 }))
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'completed', output: [{
        type: 'function_call', name: TOOL.name,
        arguments: JSON.stringify({ decision: 'act', operation: 'Ship it' }),
      }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runProviderChainReviewStep(request())
    expect(result.provider).toBe('openai')
    expect(result.toolInput).toMatchObject({ decision: 'act' })
  })

  it('logs only a sanitized failure class, never the message body', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failure = Object.assign(new Error('private prompt and account text'), { status: 400 })
    mocks.createMessage.mockRejectedValue(failure)

    await expect(runProviderChainReviewStep(request())).rejects.toThrow()

    const logged = warn.mock.calls.map(call => JSON.stringify(call)).join(' ')
    expect(logged).toContain('invalid_request')
    expect(logged).not.toContain('private prompt')
    expect(logged).not.toContain('account text')
  })
})

describe('provider contract hardening (independent audit)', () => {
  beforeEach(() => {
    mocks.createMessage.mockReset()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
  })

  it('rejects an Anthropic text fallback when the turn was truncated', async () => {
    // max_tokens means the answer was cut off; the JSON may look valid.
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"decision":"act","operation":"Ship it"}' }],
    })
    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })

  it('rejects a refusal/pause turn that carries JSON text', async () => {
    for (const stop of ['refusal', 'pause_turn']) {
      mocks.createMessage.mockReset()
      mocks.createMessage.mockResolvedValue({
        stop_reason: stop,
        content: [{ type: 'text', text: '{"decision":"act","operation":"Ship it"}' }],
      })
      await expect(runProviderChainReviewStep(request())).rejects.toThrow()
    }
  })

  it('accepts the last fenced block when a critique quotes the draft first', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: [
        'The draft proposed:',
        '```json',
        '{"decision":"invent","operation":"Draft answer"}',
        '```',
        'My reviewed answer:',
        '```json',
        '{"decision":"act","operation":"Ship it"}',
        '```',
      ].join('\n') }],
    })
    const result = await runProviderChainReviewStep(request())
    expect(result.toolInput).toMatchObject({ decision: 'act', operation: 'Ship it' })
  })

  it('uses the Gemini header auth, filters thought parts and requires STOP', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{
        finishReason: 'STOP',
        content: { parts: [
          { text: 'internal thinking', thought: true },
          { text: '{"decision":"act","operation":"Ship it"}' },
        ] },
      }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await runProviderChainReviewStep(request())
    expect(result.provider).toBe('gemini')
    expect(result.toolInput).toMatchObject({ decision: 'act' })
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).not.toContain('key=')
    expect(init.headers['x-goog-api-key']).toBe('gemini-test-key')
  })

  it('rejects a truncated Gemini review turn', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{
        finishReason: 'MAX_TOKENS',
        content: { parts: [{ text: '{"decision":"act","operation":"Ship it"}' }] },
      }] }),
    }))
    await expect(runProviderChainReviewStep(request())).rejects.toThrow()
  })
})
