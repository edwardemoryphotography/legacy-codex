import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { validateToolInput, type ToolSchema } from './toolSchemaValidation'

export type ModelProviderId = 'anthropic' | 'gemini' | 'openai'

export type ModelTier = 'routine' | 'deep'
// Model IDs verified against official provider catalogs (October 2026).
// Scoped overrides intentionally replace legacy OPENAI_MODEL and GEMINI_MODEL,
// which can silently pin a previous-generation model.
const MODELS: Record<ModelTier, Record<ModelProviderId, string>> = {
  routine: { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-3.8-flash', openai: 'gpt-6.1-terra' },
  deep: { anthropic: 'claude-opus-5-5', gemini: 'gemini-4-argon', openai: 'gpt-6.1-sol' },
}
export function modelFor(provider: ModelProviderId, tier: ModelTier): string {
  return process.env[`CODEX_${tier.toUpperCase()}_${provider.toUpperCase()}_MODEL`]?.trim() || MODELS[tier][provider]
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
  stopReason: 'end_turn' | 'tool_use' | 'structured_text' | 'other'
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

async function callGeminiText(req: TextGenerationRequest, timeoutMs: number, model: string, tier: ModelTier): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  // Gemini 4 Argon spends output tokens on internal thinking. Use Google's
  // recommended minimum cap; lower thinking effort for economical requests.
  const maxOutputTokens = model === 'gemini-4-argon' ? Math.max(req.maxTokens, 32_768) : req.maxTokens
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
        generationConfig: { maxOutputTokens, thinkingConfig: { thinkingLevel: tier === 'deep' ? 'medium' : 'low' } },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  }
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Invalid model response')
  const text = (candidate?.content?.parts ?? []).filter(part => !part.thought).map(part => part.text ?? '').join(' ').trim()
  if (!text) throw new Error('Invalid model response')
  return text
}

async function callOpenAIText(req: TextGenerationRequest, timeoutMs: number, model: string, tier: ModelTier): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model, instructions: req.system, input: req.userContent,
      max_output_tokens: req.maxTokens, reasoning: { effort: tier === 'deep' ? 'medium' : 'low' }, store: false,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as {
    status?: string
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
  }
  if (data.status && data.status !== 'completed') throw new Error('Invalid model response')
  const text = (data.output ?? []).filter(item => item.type === 'message')
    .flatMap(item => item.content ?? []).filter(item => item.type === 'output_text')
    .map(item => item.text ?? '').join('\n').trim()
  if (!text) throw new Error('Invalid model response')
  return text
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
  const tier = req.tier ?? 'deep'
  let lastError: unknown = null
  const fallbacks: TextGenerationResult['fallbacks'] = []
  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i]!
    const remainingProviders = providers.length - i
    try {
      const attemptTimeoutMs = nextAttemptTimeoutMs(deadlineAt, remainingProviders, req.timeoutMs ?? 25_000)
      let text: string
      const model = modelFor(provider, tier)
      if (provider === 'anthropic') {
        const client = new Anthropic({ maxRetries: 0, timeout: attemptTimeoutMs })
        const response = await client.messages.create({
          model, max_tokens: req.maxTokens, system: req.system,
          messages: [{ role: 'user', content: req.userContent }],
        })
        if (response.stop_reason && response.stop_reason !== 'end_turn') throw new Error('Invalid model response')
        text = response.content.filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text).join(' ').trim()
      } else if (provider === 'gemini') {
        text = await callGeminiText(req, attemptTimeoutMs, model, tier)
      } else {
        text = await callOpenAIText(req, attemptTimeoutMs, model, tier)
      }
      if (!text) throw new Error('Invalid model response')
      return { text, provider, model, fallbacks }
    } catch (err) {
      lastError = err
      const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined
      const message = err instanceof Error ? err.message : ''
      const reason = status === 429 || /HTTP 429/.test(message) ? 'rate limited'
        : /timeout|deadline|abort/i.test(message) ? 'timed out'
          : message === 'Invalid model response' ? 'empty or incomplete response'
            : status === 401 || status === 403 || /HTTP 401|HTTP 403/.test(message) ? 'provider authorization failed'
              : status === 400 || status === 404 || /HTTP 400|HTTP 404/.test(message) ? 'model or request rejected'
                : 'unavailable'
      fallbacks.push({ provider, reason })
      console.warn('Model provider failed', { provider, reason })
    }
  }
  throw lastError ?? new Error('All configured model providers failed')
}

async function callGeminiReviewStep(req: ReviewStepRequest, timeoutMs: number): Promise<ReviewStepResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const model = modelFor('gemini', 'deep')

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.userContent }] }],
    generationConfig: {
      maxOutputTokens: model === 'gemini-4-argon' ? Math.max(req.maxTokens, 32_768) : req.maxTokens,
      thinkingConfig: { thinkingLevel: 'medium' },
    },
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
  const model = modelFor('openai', 'deep')
  const payload: Record<string, unknown> = {
    model, instructions: req.system, input: req.userContent,
    max_output_tokens: Math.max(req.maxTokens, 12_288),
    reasoning: { effort: 'medium' }, store: false,
  }
  if (req.requireToolOutput) {
    payload.tools = [{
      type: 'function', name: req.tool.name,
      description: req.tool.description ?? '',
      parameters: req.tool.input_schema, strict: false,
    }]
    payload.tool_choice = { type: 'function', name: req.tool.name }
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as {
    status?: string
    output?: Array<{ type?: string; name?: string; arguments?: string; content?: Array<{ type?: string; text?: string }> }>
  }
  if (data.status && data.status !== 'completed') return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
  if (req.requireToolOutput) {
    const call = data.output?.find(item => item.type === 'function_call' && item.name === req.tool.name)
    if (!call?.arguments) return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
    try {
      return { stopReason: 'tool_use', text: '', toolInput: JSON.parse(call.arguments), provider: 'openai' }
    } catch {
      return { stopReason: 'other', text: '', toolInput: null, provider: 'openai' }
    }
  }
  const text = (data.output ?? []).flatMap(item => item.type === 'message' ? item.content ?? [] : [])
    .filter(item => item.type === 'output_text').map(item => item.text ?? '').join('\n').trim()
  return { stopReason: text ? 'end_turn' : 'other', text, toolInput: null, provider: 'openai' }
}

/**
 * Executes a structured review step (draft or critique) across the configured
 * provider chain (Claude -> Gemini -> OpenAI).
 */
/**
 * Opus 5.5 rejects forced tool choice (`tool_choice` values "tool" and "any"
 * return HTTP 400). Keep `auto` and accept either one matching tool_use block
 * or, when the model answers in text, a JSON object carrying every schema
 * `required` key. Prose never qualifies; downstream source/proposal validation
 * still runs authoritatively.
 */
function structuredToolInput(text: string, tool: ReviewStepRequest['tool']): Record<string, unknown> | null {
  const schema = tool.input_schema as ToolSchema
  const required = Array.isArray(schema.required) ? schema.required : []
  if (!required.length) return null
  const candidates = [text.trim()]
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed: unknown = JSON.parse(candidate)
      // Complete structural check against the tool schema, not just keys.
      if (validateToolInput(parsed, schema) === null) return parsed as Record<string, unknown>
    } catch { /* not JSON; try the next candidate */ }
  }
  return null
}

/** Sanitized failure class for diagnostics. Never logs model or prompt text. */
function providerFailureReason(err: unknown): { reason: string; status?: number } {
  const raw = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : undefined
  const status = Number.isFinite(raw) ? raw : undefined
  const message = err instanceof Error ? err.message : ''
  const fromMessage = /HTTP (\d{3})/.exec(message)
  const code = status ?? (fromMessage ? Number(fromMessage[1]) : undefined)
  const reason = code === 429 ? 'rate_limited'
    : code === 400 ? 'invalid_request'
      : code !== undefined && code >= 500 ? 'provider_error'
        : /timeout|deadline|abort/i.test(message) ? 'timed_out'
          : code !== undefined ? 'http_error' : 'unavailable_or_incomplete'
  return code === undefined ? { reason } : { reason, status: code }
}

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
      let result: ReviewStepResult | null = null
      if (provider === 'anthropic') {
        const model = new Anthropic({ maxRetries: 0, timeout: attemptTimeoutMs })
        const response = await model.messages.create({
          model: modelFor('anthropic', 'deep'),
          max_tokens: req.maxTokens,
          system: req.system,
          // Opus 5.5: `tool_choice` "tool"/"any" is a 400. The prompt names the
          // tool; the acceptance gate below still requires structured output.
          ...(req.requireToolOutput
            ? { tools: [req.tool], tool_choice: { type: 'auto' as const, disable_parallel_tool_use: true } }
            : {}),
          messages: [{ role: 'user', content: req.userContent }],
        })
        // Adaptive thinking returns thinking blocks first: select by type.
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        const outputs = response.content.filter(
          (block): block is Anthropic.ToolUseBlock =>
            block.type === 'tool_use' && block.name === req.tool.name,
        )
        if (req.requireToolOutput) {
          const validToolUse = response.stop_reason === 'tool_use' && outputs.length === 1 &&
            validateToolInput(outputs[0].input, req.tool.input_schema as ToolSchema) === null
          if (validToolUse) {
            result = { stopReason: 'tool_use', text: '', toolInput: outputs[0].input, provider: 'anthropic' }
          } else {
            const structured = structuredToolInput(text, req.tool)
            if (structured) result = { stopReason: 'structured_text', text: '', toolInput: structured, provider: 'anthropic' }
          }
        } else {
          if (response.stop_reason !== 'end_turn' || !text.trim()) throw new Error('Invalid model response')
          result = { stopReason: 'end_turn', text, toolInput: null, provider: 'anthropic' }
        }
      } else if (provider === 'gemini' || provider === 'openai') {
        const called = provider === 'gemini'
          ? await callGeminiReviewStep(req, attemptTimeoutMs)
          : await callOpenAIReviewStep(req, attemptTimeoutMs)
        if (!req.requireToolOutput) {
          if (called.stopReason !== 'end_turn' || !called.text.trim()) throw new Error('Invalid model response')
          result = called
        } else if (called.stopReason === 'tool_use' && called.toolInput &&
          validateToolInput(called.toolInput, req.tool.input_schema as ToolSchema) === null) {
          result = called
        } else {
          const structured = structuredToolInput(called.text, req.tool)
          if (structured) result = { ...called, stopReason: 'structured_text', toolInput: structured }
        }
      }
      if (!result) throw new Error('Invalid model response')
      return result
    } catch (err) {
      lastError = err
      // Status class only: never model output, prompts, or account context.
      console.warn('Model review provider failed', { provider, ...providerFailureReason(err) })
    }
  }
  throw lastError ?? new Error('All configured model providers failed')
}
