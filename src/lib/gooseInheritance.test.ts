// Regression inputs are the existing repository's real evidence and doctrine.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COGNITIVE_DOCTRINE } from './cognitiveDoctrine'
import { operationsEquivalent } from './operationEquivalence'
import { buildTaskRoute } from './taskRouting'

describe('Goose inheritance boundaries', () => {
  it('carries the reviewed public doctrine into the real integration handoff', () => {
    const task = 'Implement the Codex Control Panel design and task-routing experience into Legacy Codex Strategic Delta, preserving project context, evidence, corrections, and pause/reload/resume continuity.'
    const route = buildTaskRoute(task, { mission: null, missionStatus: 'unavailable', evidenceStatus: 'unavailable', evidence: [] },
      { currentTool: 'Codex', stayHere: false, hybrid: true, priority: 'balanced' }, {})
    expect(route.primary.prompt).toContain(COGNITIVE_DOCTRINE)
    if (route.secondary) expect(route.secondary.prompt).toContain(COGNITIVE_DOCTRINE)
  })
  it('each model surface reads authenticated learned context before calling the provider', () => {
    for (const surface of ['analyze', 'brief', 'delta-operation']) {
      const code = readFileSync(`src/app/api/${surface}/route.ts`, 'utf8')
      expect(code).toContain('loadLearnedContext')
      expect(code.indexOf('await loadLearnedContext')).toBeLessThan(code.indexOf('client.messages.create'))
    }
  })
  it('recognizes conservative lexical variants without dropping negation or object order', () => {
    const operation = 'Inspect the existing code first'
    expect(operationsEquivalent(operation, 'Please inspecting existing code first.')).toBe(true)
    expect(operationsEquivalent(operation, 'Do not inspect the existing code first')).toBe(false)
    expect(operationsEquivalent('Move A to B', 'Move B to A')).toBe(false)
    expect(operationsEquivalent('Inspect A', 'Inspect')).toBe(false)
    expect(operationsEquivalent('Move A to B', 'Move to B')).toBe(false)
    expect(operationsEquivalent('Inspect The', 'Inspect')).toBe(false)
  })
  it('does not stop lesson retrieval at the old newest-50 window', () => {
    const code = readFileSync('src/lib/projectLessonsServer.ts', 'utf8')
    expect(code).not.toContain('.limit(50)')
    expect(code).toContain('.range(')
    expect(code).toContain("order('id'")
  })
})
