import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

export type ModelProviderId = 'anthropic' | 'gemini' | 'openai'

const ANTHROPIC_MODEL = 'claude-opus-5'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro'
const DEFAULT_OPENAI_MODEL = 'gpt-4o'

/**
 * Returns configured server-side model providers in priority order:
 * 1. Claude (ANTHROPIC_API_KEY)
 * 2. Gemini (GEMINI_API_KEY)
 * 3. OpenAI (OPENAI_API_KEY)
 */
export function configuredModelProviders(): ModelProviderId[] {
  const providers: ModelProviderId[] = []
  if (process.env.ANTHROPIC_API_KEY?.trim()) providers.push('anthropic')
  if (process.env.GEMINI_API_KEY?.trim()) providers.push('gemini')
  if (process.env.OPENAI_API_KEY?.trim()) providers.push('openai')
  return providers
}

export function isModelChainConfigured(): boolean {
  return configuredModelProviders().length > 0
}

export interface TextGenerationRequest {
  system: string
  userContent: string
  maxTokens: number
  timeoutMs?: number
  deadlineAt?: number
  skipAnthropic?: boolean
}

export interface TextGenerationResult {
  text: string
  provider: ModelProviderId
}

export interface ReviewStepRequest {
  system: string
  userContent: string
  maxTokens: number
  requireToolOutput: boolean
  tool: Tool
  timeoutMs?: number
  deadlineAt?: number
}

export interface ReviewStepResult {
  stopReason: 'end_turn' | 'tool_use' | 'other'
  text: string
  toolInput: unknown | null
  provider: ModelProviderId
}

function nextAttemptTimeoutMs(
  deadlineAt: number,
  remainingProviders: number,
  maxAttemptMs = 25_000,
): number {
  const remainingMs = deadlineAt - Date.now()
  if (remainingMs <= 0) {
    throw new Error('Model request deadline exceeded')
  }
  const fairShare = Math.floor(remainingMs / Math.max(1, remainingProviders))
  return Math.max(1, Math.min(maxAttemptMs, fairShare, remainingMs))
}

async function callGeminiText(req: TextGenerationRequest, timeoutMs: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
        generationConfig: { maxOutputTokens: req.maxTokens },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return parts
    .map(p => (typeof p.text === 'string' ? p.text : ''))
    .join(' ')
    .trim()
}

async function callOpenAIText(req: TextGenerationRequest, timeoutMs: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.userContent },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

/**
 * Executes a bounded text generation across the configured provider chain
 * (Claude -> Gemini -> OpenAI). Preserves the last thrown error if all
 * configured providers fail.
 */
export async function runProviderChainText(req: TextGenerationRequest): Promise<TextGenerationResult> {
  const providers = configuredModelProviders().filter(p => !(req.skipAnthropic && p === 'anthropic'))
  if (providers.length === 0) {
    throw new Error('No model provider configured')
  }

  const deadlineAt = req.deadlineAt ?? Date.now() + (req.timeoutMs ?? 45_000)
  let lastError: unknown = null
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!
    const remainingProviders = providers.length - i
    try {
      const attemptTimeoutMs = nextAttemptTimeoutMs(deadlineAt, remainingProviders, req.timeoutMs ?? 25_000)
      if (provider === 'anthropic') {
        const client = new Anthropic({ maxRetries: 0, timeout: attemptTimeoutMs })
        const response = await client.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.userContent }],
        })
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join(' ')
          .trim()
        return { text, provider: 'anthropic' }
      }
      if (provider === 'gemini') {
        const text = await callGeminiText(req, attemptTimeoutMs)
        return { text, provider: 'gemini' }
      }
      if (provider === 'openai') {
        const text = await callOpenAIText(req, attemptTimeoutMs)
        return { text, provider: 'openai' }
      }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('All configured model providers failed')
}

async function callGeminiReviewStep(req: ReviewStepRequest, timeoutMs: number): Promise<ReviewStepResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
    generationConfig: req.requireToolOutput
      ? {
          maxOutputTokens: req.maxTokens,
          responseMimeType: 'application/json',
        }
      : { maxOutputTokens: req.maxTokens },
  }

  if (req.requireToolOutput) {
    body.tools = [
      {
        functionDeclarations: [
          {
            name: req.tool.name,
            description: req.tool.description ?? '',
            parametersJsonSchema: req.tool.input_schema,
          },
        ],
      },
    ]
    body.toolConfig = {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [req.tool.name],
      },
    }
    delete (body.generationConfig as Record<string, unknown>).responseMimeType
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{
      finishReason?: string
      content?: {
        parts?: Array<{
          text?: string
          functionCall?: { name?: string; args?: unknown }
        }>
      }
    }>
  }

  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  if (req.requireToolOutput) {
    const fnPart = parts.find(p => p.functionCall && p.functionCall.name === req.tool.name)
    if (fnPart?.functionCall?.args && typeof fnPart.functionCall.args === 'object') {
      return {
        stopReason: 'tool_use',
        text: '',
        toolInput: fnPart.functionCall.args,
        provider: 'gemini',
      }
    }
    const textJoined = parts.map(p => p.text ?? '').join('\n').trim()
    if (textJoined) {
      try {
        return {
          stopReason: 'tool_use',
          text: textJoined,
          toolInput: JSON.parse(textJoined),
          provider: 'gemini',
        }
      } catch {
        return { stopReason: 'other', text: textJoined, toolInput: null, provider: 'gemini' }
      }
    }
    return { stopReason: 'other', text: '', toolInput: null, provider: 'gemini' }
  }

  const text = parts.map(p => p.text ?? '').join('\n').trim()
  const finishedCleanly = !candidate?.finishReason || candidate.finishReason === 'STOP'
  return {
    stopReason: finishedCleanly && text ? 'end_turn' : 'other',
    text,
    toolInput: null,
    provider: 'gemini',
  }
}

async function callOpenAIReviewStep(req: ReviewStepRequest, timeoutMs: number): Promise<ReviewStepResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL

  const payload: Record<string, unknown> = {
    model,
    max_tokens: req.maxTokens,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.userContent },
    ],
  }

  if (req.requireToolOutput) {
    payload.tools = [
      {
        type: 'function',
        function: {
          name: req.tool.name,
          description: req.tool.description ?? '',
          parameters: req.tool.input_schema,
        },
      },
    ]
    payload.tool_choice = {
      type: 'function',
      function: { name: req.tool.name },
    }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string
      message?: {
        content?: string | null
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string }
        }>
      }
    }>
  }

  const choice = data.choices?.[0]
  if (req.requireToolOutput) {
    const call = choice?.message?.tool_calls?.find(tc => tc.function?.name === req.tool.name)
    if (call?.function?.arguments) {
      try {
        return {
          stopReason: 'tool_use',
          text: '',
          toolInput: JSON.parse(call.function.arguments),
          provider: 'openai',
        }
      } catch {
        return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
      }
    }
    return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
  }

  const text = (choice?.message?.content ?? '').trim()
  const finishedCleanly = !choice?.finish_reason || choice.finish_reason === 'stop'
  return {
    stopReason: finishedCleanly && text ? 'end_turn' : 'other',
    text,
    toolInput: null,
    provider: 'openai',
  }
}

/**
 * Executes a structured review step (draft or critique) across the configured
 * provider chain (Claude -> Gemini -> OpenAI).
 */
export async function runProviderChainReviewStep(req: ReviewStepRequest): Promise<ReviewStepResult> {
  const providers = configuredModelProviders()
  if (providers.length === 0) {
    throw new Error('No model provider configured')
  }

  const deadlineAt = req.deadlineAt ?? Date.now() + (req.timeoutMs ?? 45_000)
  let lastError: unknown = null
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!
    const remainingProviders = providers.length - i
    try {
      const attemptTimeoutMs = nextAttemptTimeoutMs(deadlineAt, remainingProviders, req.timeoutMs ?? 25_000)
      if (provider === 'anthropic') {
        const model = new Anthropic({ maxRetries: 0, timeout: attemptTimeoutMs })
        const response = await model.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: req.maxTokens,
          system: req.system,
          ...(req.requireToolOutput
            ? {
                tools: [req.tool],
                tool_choice: {
                  type: 'tool' as const,
                  name: req.tool.name,
                  disable_parallel_tool_use: true,
                },
              }
            : {}),
          messages: [{ role: 'user', content: req.userContent }],
        })
        if (req.requireToolOutput) {
          const outputs = response.content.filter(
            (block): block is Anthropic.ToolUseBlock =>
              block.type === 'tool_use' && block.name === req.tool.name,
          )
          const validToolUse = response.stop_reason === 'tool_use' && outputs.length === 1
          return {
            stopReason: validToolUse ? 'tool_use' : 'other',
            text: '',
            toolInput: validToolUse ? outputs[0].input : null,
            provider: 'anthropic',
          }
        }
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        return {
          stopReason: response.stop_reason === 'end_turn' ? 'end_turn' : 'other',
          text,
          toolInput: null,
          provider: 'anthropic',
        }
      }
      if (provider === 'gemini') {
        return await callGeminiReviewStep(req, attemptTimeoutMs)
      }
      if (provider === 'openai') {
        return await callOpenAIReviewStep(req, attemptTimeoutMs)
      }
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('All configured model providers failed')
}

