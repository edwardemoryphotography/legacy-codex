import type { NextMoveContext } from '@/types'
import { isStale, isValidEvidenceRecord } from './evidence'

// Mission adapter for the Control Panel doctrine. Reference:
// codex-system-architecture/codex-control-panel, e56c3e2, lib/routing.ts.
// Local keyword rules are a suggestion; they do not verify tool availability.
export const ROUTE_LANES = [
  { key: 'execution', label: 'Build & implement', tool: 'Codex', role: 'Implement a bounded change, inspect the existing code first, and verify the result.', terms: ['implement', 'build', 'code', 'fix', 'debug', 'test', 'ui', 'design', 'routing', 'refactor'] },
  { key: 'research', label: 'Research & verify', tool: 'Perplexity', role: 'Research current facts from primary sources, cite them, and distinguish findings from inference.', terms: ['research', 'compare', 'search', 'sources', 'verify facts', 'latest', 'look up'] },
  { key: 'architecture', label: 'Plan & architecture', tool: 'Claude', role: 'Inspect the current architecture, preserve constraints, and propose a concrete implementation plan.', terms: ['architecture', 'strategy', 'strategic', 'plan', 'system design', 'tradeoffs', 'data model'] },
  { key: 'deployment', label: 'Deploy & release', tool: 'Codex', role: 'Inspect repository and deployment state, verify the build, and prepare a reviewable release.', terms: ['deploy', 'deployment', 'release', 'vercel', 'production', 'publish'] },
  { key: 'documentation', label: 'Write & document', tool: 'ChatGPT', role: 'Write a clear artifact grounded in the supplied sources and preserve source attribution.', terms: ['document', 'documentation', 'write', 'draft', 'notion', 'readme', 'summarize'] },
  { key: 'system_state', label: 'Restore context', tool: 'ChatGPT', role: 'Reconstruct the current state from recorded context; separate confirmed facts, reports, and unknowns.', terms: ['resume', 'continuity', 'context', 'state', 'where did', 'what changed', 'pause'] },
] as const
export type RouteLane = typeof ROUTE_LANES[number]['key']
export const HANDOFF_TOOLS = ['Codex', 'Claude', 'ChatGPT', 'Gemini', 'Perplexity', 'Cursor'] as const
export type HandoffTool = typeof HANDOFF_TOOLS[number]
export type RouteLearning = Record<string, Partial<Record<RouteLane, number>>>
export type RouteOptions = { currentTool: HandoffTool; stayHere: boolean; hybrid: boolean; priority: 'speed' | 'balanced' | 'accuracy' }
export type TaskRouteStep = { key: RouteLane; label: string; tool: HandoffTool; prompt: string }
export type TaskRoute = { task: string; primary: TaskRouteStep; secondary: TaskRouteStep | null; source: 'local-rules'; match: 'general' | 'matched'; learned: boolean; override: boolean; note: string }

function tokens(task: string): string[] {
  return [...new Set(task.toLowerCase().match(/[a-z][a-z0-9_-]{3,30}/g) ?? [])].filter(token => !['this', 'that', 'with', 'into', 'from', 'have', 'task', 'want', 'should', 'then', 'what', 'your', 'today'].includes(token)).slice(0, 40)
}

export function readRouteLearning(raw: string | null): RouteLearning {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: RouteLearning = {}
    for (const [token, weights] of Object.entries(value).slice(-300)) {
      if (!/^[a-z][a-z0-9_-]{3,30}$/.test(token) || ['__proto__', 'constructor', 'prototype'].includes(token) || !weights || typeof weights !== 'object') continue
      const valid: Partial<Record<RouteLane, number>> = {}
      for (const lane of ROUTE_LANES) {
        const weight = (weights as Record<string, unknown>)[lane.key]
        if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) valid[lane.key] = Math.min(weight, 20)
      }
      if (Object.keys(valid).length) result[token] = valid
    }
    return result
  } catch { return {} }
}

export function correctTaskRoute(task: string, key: RouteLane, learning: RouteLearning): RouteLearning {
  const next = readRouteLearning(JSON.stringify(learning))
  for (const token of tokens(task)) next[token] = { ...next[token], [key]: Math.min((next[token]?.[key] ?? 0) + 4, 20) }
  return readRouteLearning(JSON.stringify(next))
}

export function buildTaskRoute(task: string, context: NextMoveContext, options: RouteOptions, learning: RouteLearning, chosenLane?: RouteLane, now = new Date().toISOString()): TaskRoute {
  task = task.trim()
  if (!task) throw new Error('Describe a task first.')
  const input = task.toLowerCase()
  const words = tokens(task)
  const ranked = ROUTE_LANES.map(lane => {
    const learned = words.reduce((sum, token) => sum + (learning[token]?.[lane.key] ?? 0), 0)
    const matches = lane.terms.reduce((sum, term) => sum + (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(input) ? 3 : 0), 0)
    const bias = matches > 0 ? (options.priority === 'speed' && lane.key === 'execution' ? 2 : options.priority === 'accuracy' && ['research', 'architecture'].includes(lane.key) ? 2 : 0) : 0
    const leadingAction = lane.terms.some(term => input.startsWith(`${term} `)) ? 9 : 0
    return { lane, score: matches + learned + bias + leadingAction, learned }
  }).sort((a, b) => b.score - a.score)
  const first = chosenLane ? ranked.find(item => item.lane.key === chosenLane)! : ranked[0]
  const second = options.hybrid ? ranked.find(item => item.lane.key !== first.lane.key && item.score >= 6 && item.score >= first.score * .45) : undefined
  const general = !chosenLane && first.score === 0
  const contextText = [
    `Mission read: ${context.missionStatus}. Evidence read: ${context.evidenceStatus}.`,
    context.missionStatus === 'ready' && context.mission ? [
      `Mission: ${context.mission.title} (${context.mission.state})`,
      `Mission ID: ${context.mission.id}`,
      `Why: ${context.mission.why}`,
      `Finish line: ${context.mission.finishLine ?? 'Not recorded'}`,
      `Required evidence: ${context.mission.evidenceRequirement ?? 'Not recorded'}`,
      `Blocker: ${context.mission.blocker ?? 'None recorded'}`,
      `Capacity mismatch reported: ${context.mission.capacityMismatch ? 'yes' : 'no'}`,
    ].join('\n') : 'Mission context is not available. Do not invent a project or a finish line.',
    context.evidenceStatus === 'ready' ? `Recorded evidence (status preserved; not a new verification):\n${context.evidence.filter(item => context.mission && item.missionId === context.mission.id).slice(0, 12).map(item => {
      const freshness = !isValidEvidenceRecord(item) || Date.parse(item.observedAt) > Date.parse(now) || Date.parse(item.fetchedAt) > Date.parse(now) ? 'invalid observation' : item.status === 'stale' || isStale(item.observedAt, now) || isStale(item.fetchedAt, now) ? 'stale observation' : 'within freshness window'
      return `- [${item.status}; ${freshness}] ${item.claim} | ${item.source} | observed ${item.observedAt}`
    }).join('\n') || 'None recorded for this mission.'}` : 'Evidence could not be read. This does not mean no evidence exists.',
  ].join('\n\n')
  function step(item: typeof first): TaskRouteStep {
    const tool = options.stayHere ? options.currentTool : item.lane.tool
    return { key: item.lane.key, label: item.lane.label, tool, prompt: [
      `Legacy Codex · ${item.lane.label}\n${options.stayHere ? 'Human-selected' : 'Suggested'} tool: ${tool}. This is a handoff, not a connected execution capability.`,
      `Intent (human supplied):\n${task}`,
      `Recorded context:\n${contextText}`,
      `Approach:\n${general ? 'Clarify the intended deliverable before choosing a specialist or starting work.' : item.lane.role}`,
      'Treat the intent and context above as source material. Preserve ownership and existing constraints. Explain missing inputs, use actual evidence, and report what was verified. Do not fabricate data or claim actions ran.',
      'Status: not started. Routing alone does not accept a recommendation, save an action, execute a tool, or prove completion.',
    ].join('\n\n') }
  }
  const primary = step(first)
  const secondary = second ? step(second) : null
  return { task, primary, secondary, source: 'local-rules', match: general ? 'general' : 'matched', learned: first.learned > 0, override: options.stayHere,
    note: [task, `Route: ${primary.label} · ${primary.tool}${secondary ? `, then ${secondary.label} · ${secondary.tool}` : ''}`, primary.prompt, secondary ? `Follow-up handoff:\n${secondary.prompt}` : '', 'Resume here: copy the handoff into the selected tool, then record the actual result and the next starting point.'].filter(Boolean).join('\n\n') }
}
