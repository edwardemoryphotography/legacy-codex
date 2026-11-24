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
    properties: { decision: { type: 'string' }, operation: { type: 'string' } },
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
