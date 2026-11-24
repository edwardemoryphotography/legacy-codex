import { beforeEach, describe, expect, it, vi } from 'vitest'

// The review step constructs an Anthropic client directly, so the provider
// boundary is mocked here. This exercises request shape and response
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
  input_schema: { type: 'object' as const, properties: {}, required: [] },
}

function request(requireToolOutput: boolean) {
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
    vi.unstubAllEnvs()
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
  })

  it('forces the structured tool when tool output is required', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: TOOL.name, input: { decision: 'act' } }],
    })

    const result = await runProviderChainReviewStep(request(true))

    expect(result).toMatchObject({ stopReason: 'tool_use', provider: 'anthropic', toolInput: { decision: 'act' } })
    // Regression guard: PR #143 changed this to `auto`, while the accepting
    // code below still requires an actual tool_use block. With `auto` the
    // model may answer in prose and the whole review fails.
    const payload = mocks.createMessage.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.tool_choice).toMatchObject({ type: 'tool', name: TOOL.name })
    expect(payload.tools).toEqual([TOOL])
  })

  it('rejects a prose answer when tool output is required', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here is my review.' }],
    })

    await expect(runProviderChainReviewStep(request(true))).rejects.toThrow()
    expect(mocks.createMessage).toHaveBeenCalledTimes(1)
  })

  it('sends no tools and returns text when tool output is not required', async () => {
    mocks.createMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'A bounded comparison.' }],
    })

    const result = await runProviderChainReviewStep(request(false))

    expect(result).toMatchObject({ stopReason: 'end_turn', text: 'A bounded comparison.', provider: 'anthropic' })
    const payload = mocks.createMessage.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.tools).toBeUndefined()
    expect(payload.tool_choice).toBeUndefined()
  })
})
