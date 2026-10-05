import { applyRouteTokens, ROUTE_LANES, type RouteLane, type RouteLearning } from './taskRouting'
import type { projectUserClient } from './projectReviewServer'

type Client = ReturnType<typeof projectUserClient>
export function parseRouteCorrection(value: unknown): { tokens: string[]; lane: RouteLane } | null {
  if (!value || typeof value !== 'object') return null
  const row = value as { tokens?: unknown; lane?: unknown }
  if (!ROUTE_LANES.some(lane => lane.key === row.lane) || !Array.isArray(row.tokens) || row.tokens.length > 40 ||
      !row.tokens.length || row.tokens.some(token => typeof token !== 'string' || !/^[a-z][a-z0-9_-]{3,30}$/.test(token) || ['__proto__', 'constructor', 'prototype'].includes(token))) return null
  return { tokens: [...new Set(row.tokens)] as string[], lane: row.lane as RouteLane }
}
// Append-only account records are the input; bounded weights are a derived
// read model. This does not replace Foundry's canonical routing ownership.
export async function loadRouteLearning(client: Client, userId: string): Promise<RouteLearning> {
  let weights: RouteLearning = {}
  const through = new Date().toISOString()
  for (let offset = 0; ; offset += 100) {
    const result = await client.from('mission_events').select('detail')
      .eq('user_id', userId).eq('type', 'task_route_corrected').lte('created_at', through)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 99)
    if (result.error) throw new Error('Routing corrections unavailable.')
    for (const row of result.data ?? []) {
      const correction = parseRouteCorrection(JSON.parse(row.detail))
      if (!correction) throw new Error('Routing correction could not be reconstructed.')
      weights = applyRouteTokens(correction.tokens, correction.lane, weights)
    }
    if ((result.data?.length ?? 0) < 100) return weights
  }
}
