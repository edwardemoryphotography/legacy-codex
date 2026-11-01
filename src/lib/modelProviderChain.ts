import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

export type ModelProviderId = 'anthropic' | 'gemini' | 'openai'

export type ModelTier = 'efficient' | 'deep'
const ANTHROPIC_MODEL = 'claude-opus-5-5'
const ANTHROPIC_EFFICIENT_MODEL = 'claude-sonnet-5-5'
const DEFAULT_GEMINI_MODEL = 'gemini-4-argon'
const EFFICIENT_GEMINI_MODEL = 'gemini-3.8-flash'
const DEFAULT_OPENAI_MODEL = 'gpt-6.1-sol'
const EFFICIENT_OPENAI_MODEL = 'gpt-6.1-terra'

function selectModel(provider: ModelProviderId, tier: ModelTier): string {
  if (provider === 'anthropic') return tier === 'deep' ? ANTHROPIC_MODEL : ANTHROPIC_EFFICIENT_MODEL
  if (provider === 'gemini') return process.env.GEMINI_MODEL?.trim() || (tier === 'deep' ? DEFAULT_GEMINI_MODEL : EFFICIENT_GEMINI_MODEL)
  return process.env.OPENAI_MODEL?.trim() || (tier === 'deep' ? DEFAULT_OPENAI_MODEL : EFFICIENT_OPENAI_MODEL)
}

function geminiConfig(model: string, tier: ModelTier, maxTokens: number) {
  const argon = model.startsWith('gemini-4-')
  return {
    maxOutputTokens: Math.max(maxTokens, argon ? 32768 : 8192),
    ...(argon || model.startsWith('gemini-3-') ? { thinkingConfig: { thinkingLevel: tier === 'deep' ? 'medium' : 'low' } } : {}),
  }
}

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
  tier?: ModelTier
}

export interface TextGenerationResult {
  text: string
  provider: ModelProviderId
  model: string
  fallbacks: Array<{ provider: ModelProviderId; reason: string }>
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
  const model = selectModel('gemini', req.tier ?? 'deep')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
        generationConfig: geminiConfig(model, req.tier ?? 'deep', req.maxTokens),
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
  }
  if (data.candidates?.[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') throw new Error('Invalid model response')
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return parts
    .map(p => (typeof p.text === 'string' ? p.text : ''))
    .join(' ')
    .trim()
}

type OpenAIResponse = {
  status?: string
  output_text?: string
  output?: Array<{
    type?: string
    name?: string
    arguments?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}

function openAIText(data: OpenAIResponse): string {
  if (data.status && data.status !== 'completed') throw new Error('Invalid model response')
  const fromItems = (data.output ?? [])
    .filter(item => item.type === 'message')
    .flatMap(item => (item.content ?? []).filter(part => part.type === 'output_text').map(part => part.text ?? ''))
    .join('\n')
    .trim()
  return fromItems || data.output_text?.trim() || ''
}

async function callOpenAIText(req: TextGenerationRequest, timeoutMs: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const tier = req.tier ?? 'deep'
  const model = selectModel('openai', tier)
  const payload: Record<string, unknown> = {
    model,
    instructions: req.system,
    input: req.userContent,
    // Reasoning output includes invisible thinking tokens, so a 1K ceiling
    // can exhaust before a visible answer appears.
    max_output_tokens: Math.max(req.maxTokens, tier === 'deep' ? 8192 : 4096),
    store: false,
  }
  if (model.startsWith('gpt-6') || model.startsWith('gpt-5')) {
    payload.reasoning = { effort: tier === 'deep' ? 'medium' : 'low' }
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('OpenAI HTTP ' + res.status)
  return openAIText(await res.json())
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
  const fallbacks: TextGenerationResult['fallbacks'] = []
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!
    const remainingProviders = providers.length - i
    try {
      const attemptTimeoutMs = nextAttemptTimeoutMs(deadlineAt, remainingProviders, req.timeoutMs ?? 25_000)
      let text: string
      let model: string
      if (provider === 'anthropic') {
        const client = new Anthropic({ maxRetries: 0, timeout: attemptTimeoutMs })
        const response = await client.messages.create({
          model: selectModel('anthropic', req.tier ?? 'deep'),
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content: req.userContent }],
        })
        if (response.stop_reason && response.stop_reason !== 'end_turn') throw new Error('Invalid model response')
        text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join(' ')
          .trim()
        model = selectModel('anthropic', req.tier ?? 'deep')
      } else if (provider === 'gemini') {
        text = await callGeminiText(req, attemptTimeoutMs)
        model = selectModel('gemini', req.tier ?? 'deep')
      } else {
        text = await callOpenAIText(req, attemptTimeoutMs)
        model = selectModel('openai', req.tier ?? 'deep')
      }
      if (!text) throw new Error('Invalid model response')
      return { text, provider, model, fallbacks }
    } catch (err) {
      lastError = err
      const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined
      const message = err instanceof Error ? err.message : ''
      const reason = status === 429 || /HTTP 429/.test(message) ? 'rate limited'
        : /timeout|deadline|abort/i.test(message) ? 'timed out'
          : message === 'Invalid model response' ? 'empty or incomplete response' : 'unavailable'
      fallbacks.push({ provider, reason })
      console.warn('Model provider failed', { provider, reason })
    }
  }
  throw lastError ?? new Error('All configured model providers failed')
}

async function callGeminiReviewStep(req: ReviewStepRequest, timeoutMs: number): Promise<ReviewStepResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const model = selectModel('gemini', 'deep')

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
    generationConfig: req.requireToolOutput
      ? {
          ...geminiConfig(model, 'deep', req.maxTokens),
          responseMimeType: 'application/json',
        }
      : geminiConfig(model, 'deep', req.maxTokens),
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
  const model = selectModel('openai', 'deep')
  const payload: Record<string, unknown> = {
    model,
    instructions: req.system,
    input: req.userContent,
    max_output_tokens: Math.max(req.maxTokens, 8192),
    store: false,
  }
  if (model.startsWith('gpt-6') || model.startsWith('gpt-5')) payload.reasoning = { effort: 'medium' }
  if (req.requireToolOutput) {
    payload.tools = [{
      type: 'function',
      name: req.tool.name,
      description: req.tool.description ?? '',
      parameters: req.tool.input_schema,
      strict: false,
    }]
    payload.tool_choice = { type: 'function', name: req.tool.name }
    payload.parallel_tool_calls = false
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('OpenAI HTTP ' + res.status)
  const data = (await res.json()) as OpenAIResponse
  if (data.status && data.status !== 'completed') return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
  if (req.requireToolOutput) {
    const matching = (data.output ?? []).filter(item => item.type === 'function_call' && item.name === req.tool.name)
    if (matching.length === 1 && typeof matching[0].arguments === 'string') {
      try {
        return { stopReason: 'tool_use', text: '', toolInput: JSON.parse(matching[0].arguments), provider: 'openai' }
      } catch { /* Invalid structured output must never become accepted evidence. */ }
    }
    return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
  }
  const text = openAIText(data)
  return { stopReason: text ? 'end_turn' : 'other', text, toolInput: null, provider: 'openai' }
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

