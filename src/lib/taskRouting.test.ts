import { describe, expect, it } from 'vitest'
import { buildTaskRoute, correctTaskRoute, readRouteLearning, routeTokens } from './taskRouting'
import type { NextMoveContext } from '@/types'

const context: NextMoveContext = {
  mission: null, missionStatus: 'unavailable', evidence: [], evidenceStatus: 'unavailable',
}
// Eddie's actual integration request, used during the reference inspection.
const intent = 'Implement the Codex Control Panel design and task-routing experience into Legacy Codex Strategic Delta, preserving project context, evidence, corrections, and pause/reload/resume continuity.'
const options = { currentTool: 'Codex' as const, stayHere: false, hybrid: true, priority: 'balanced' as const }

describe('Mission task routing', () => {
  it('routes the real implementation request and preserves it verbatim in a handoff', () => {
    const result = buildTaskRoute(intent, context, options, {})
    expect(result.primary.key).toBe('execution')
    expect(result.primary.tool).toBe('Codex')
    expect(result.primary.prompt).toContain(intent)
    expect(result.primary.prompt).toContain('Mission read: unavailable')
    expect(result.primary.prompt).toContain('Evidence read: unavailable')
    expect(result.primary.prompt).toContain('not started')
    expect(result.source).toBe('local-rules')
  })

  it('keeps an explicit current-tool override truthful', () => {
    const result = buildTaskRoute(intent, context, { ...options, currentTool: 'ChatGPT', stayHere: true }, {})
    expect(result.primary.tool).toBe('ChatGPT')
    expect(result.override).toBe(true)
    expect(result.primary.prompt).toContain('Human-selected tool')
  })

  it('learns a human correction without replacing the original task', () => {
    const learning = correctTaskRoute(intent, 'architecture', {})
    const result = buildTaskRoute(intent, context, options, learning)
    expect(result.primary.key).toBe('architecture')
    expect(result.primary.prompt).toContain(intent)
    expect(result.learned).toBe(true)
  })

  it('rejects malformed or unbounded stored learning', () => {
    expect(readRouteLearning('{')).toEqual({})
    expect(readRouteLearning(JSON.stringify({ '__proto__': 4, build: { execution: 'yes', deployment: 999999 }, implement: { execution: 4 } })))
      .toEqual({ build: { deployment: 20 }, implement: { execution: 4 } })
  })

  it('never turns prototype keys into persisted correction tokens', () => {
    expect(routeTokens('Fix __proto__ constructor prototype routing')).toEqual(['routing'])
  })

  it('requires a task and does not pretend an unknown task has a specialist match', () => {
    expect(() => buildTaskRoute(' ', context, options, {})).toThrow('Describe a task')
    const result = buildTaskRoute('Proceed', context, options, {})
    expect(result.match).toBe('general')
    expect(result.primary.prompt).toContain('Clarify')
  })

  it('respects single-route preference even when multiple lanes match', () => {
    expect(buildTaskRoute(intent, context, { ...options, hybrid: false }, {}).secondary).toBeNull()
  })
})
