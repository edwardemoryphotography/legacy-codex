/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { runProviderChainReviewStep } from './modelProviderChain'
import { PROJECT_REVIEW_OUTPUT, PROJECT_REVIEW_RULES } from './projectReviewPrompt'

// Opt-in real-provider probe. It is NOT product evidence: it verifies the
// production review request contract against a live provider with a minimal,
// non-personal context. Run with credentials injected; it prints sanitized
// metrics only (no prompt text, no model output).
const label = process.env.PROBE_LABEL ?? ''
const tier = process.env.PROBE_TIER === 'deep' ? 'deep' as const : 'routine' as const

describe.runIf(Boolean(label))('real provider contract probe', () => {
  it(`completes a structured review step: ${label}`, async () => {
    const started = Date.now()
    const result = await runProviderChainReviewStep({
      system: PROJECT_REVIEW_RULES,
      userContent: [
        'Mission: ship a small paid download.',
        'Finish line: one stranger has paid and downloaded it.',
        'Unfinished saved step: publish the checkout page.',
        'Compare two feasible next moves and submit one reviewed decision through submit_project_review.',
      ].join('\n'),
      maxTokens: 2_600,
      requireToolOutput: true,
      tool: PROJECT_REVIEW_OUTPUT,
      deadlineAt: Date.now() + (tier === 'deep' ? 90_000 : 45_000),
      tier,
    })
    const keys = result.toolInput && typeof result.toolInput === 'object'
      ? Object.keys(result.toolInput as Record<string, unknown>).sort() : []
    console.log('PROBE_RESULT ' + JSON.stringify({
      label, tier, provider: result.provider, stopReason: result.stopReason,
      elapsedMs: Date.now() - started, hasToolInput: Boolean(result.toolInput),
      decision: (result.toolInput as { decision?: unknown } | null)?.decision ?? null,
      requiredKeysPresent: ['decision', 'operation', 'finishWhen', 'clarification', 'sourceIds', 'unknowns']
        .every(key => keys.includes(key)),
    }))
    expect(result.toolInput).toBeTruthy()
  }, 120_000)
})
