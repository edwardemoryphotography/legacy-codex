export type NextMoveLane =
  | 'build'
  | 'research'
  | 'structure'
  | 'ship'
  | 'document'
  | 'reorient'

export interface NextMoveRecommendation {
  lane: NextMoveLane
  label: string
  nextMove: string
  why: string
  evidenceNeeded: string
  builderDestination: string
  handoff: string
  source: 'doctrine'
}

interface LaneDefinition extends Omit<NextMoveRecommendation, 'handoff' | 'source'> {
  keywords: string[]
}

const LANES: LaneDefinition[] = [
  {
    lane: 'build',
    label: 'Make the smallest real thing',
    nextMove: 'Define the smallest verifiable deliverable, build it, then run the checks that prove it works.',
    why: 'The request is mainly blocked on implementation or repair, not more planning.',
    evidenceNeeded: 'A working artifact plus the relevant test, build, or runtime result.',
    builderDestination: 'Foundry — Build',
    keywords: ['build', 'code', 'implement', 'fix', 'debug', 'refactor', 'prototype', 'create', 'automation', 'frontend', 'backend', 'app'],
  },
  {
    lane: 'research',
    label: 'Verify the unstable facts',
    nextMove: 'Check the current authoritative sources, record the contradiction if one exists, then choose from evidence.',
    why: 'The decision depends on facts that may be incomplete, external, or recently changed.',
    evidenceNeeded: 'Current primary sources and a dated conclusion that separates fact from inference.',
    builderDestination: 'Foundry — Research',
    keywords: ['research', 'compare', 'latest', 'current', 'verify', 'fact', 'market', 'pricing', 'competitor', 'source', 'documentation'],
  },
  {
    lane: 'structure',
    label: 'Make the finish line explicit',
    nextMove: 'Write the finish line and constraints in plain language, then name the first executable step.',
    why: 'The request needs decomposition or a decision boundary before execution will be reliable.',
    evidenceNeeded: 'A concrete finish line, constraints, and one action that can be completed without reopening the architecture.',
    builderDestination: 'Foundry — Architecture',
    keywords: ['architecture', 'system', 'design', 'strategy', 'reason', 'breakdown', 'plan', 'framework', 'spec', 'scope', 'clarify', 'decide'],
  },
  {
    lane: 'ship',
    label: 'Prove the release state',
    nextMove: 'Identify the exact release candidate, run its release gates, deploy it, and verify the live behavior.',
    why: 'The request is about getting verified work into a real release rather than creating more implementation paths.',
    evidenceNeeded: 'Merged commit, deployment from that commit, runtime verification, and the live URL.',
    builderDestination: 'Foundry — Release',
    keywords: ['deploy', 'deployment', 'publish', 'vercel', 'github', 'repo', 'branch', 'commit', 'pull request', 'ci', 'domain', 'hosting', 'release', 'ship'],
  },
  {
    lane: 'document',
    label: 'Turn the lesson into shared context',
    nextMove: 'Put the current conclusion in the one canonical source, including what it supersedes and what action follows.',
    why: 'The primary output is durable context another person or AI must be able to reconstruct and use.',
    evidenceNeeded: 'One canonical record with provenance, ownership, and an explicit next action.',
    builderDestination: 'Foundry — Documentation',
    keywords: ['document', 'docs', 'notion', 'notes', 'sop', 'wiki', 'brief', 'summary', 'handoff', 'playbook', 'record'],
  },
  {
    lane: 'reorient',
    label: 'Find the one blocking gap',
    nextMove: 'Compare current reality with the finish line, name the single blocking gap, and act only on that gap.',
    why: 'The request is mainly about recovering state, choosing priority, or resuming without rebuilding all context.',
    evidenceNeeded: 'A dated current-state check and one named next action.',
    builderDestination: 'Foundry — System state',
    keywords: ['status', 'state', 'resume', 'stuck', 'blocked', 'priority', 'next', 'where', 'lost', 'context', 'continue'],
  },
]

function countMatches(text: string, keywords: string[]): number {
  const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean))
  return keywords.reduce((score, keyword) => {
    const matched = keyword.includes(' ') || keyword.includes('-')
      ? text.includes(keyword)
      : words.has(keyword)
    return score + (matched ? 1 : 0)
  }, 0)
}

export function recommendNextMove(
  intent: string,
  mission?: { title: string; finishLine: string | null } | null,
): NextMoveRecommendation {
  const normalized = intent.trim().toLowerCase()
  const ranked = LANES
    .map((lane, index) => ({ lane, index, score: countMatches(normalized, lane.keywords) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const selected = ranked[0]?.score > 0
    ? ranked[0].lane
    : LANES.find(lane => lane.lane === 'structure')!

  const missionContext = mission
    ? `Mission: ${mission.title}${mission.finishLine ? `\nFinish line: ${mission.finishLine}` : ''}\n`
    : ''

  return {
    lane: selected.lane,
    label: selected.label,
    nextMove: selected.nextMove,
    why: selected.why,
    evidenceNeeded: selected.evidenceNeeded,
    builderDestination: selected.builderDestination,
    handoff: `${missionContext}Intent: ${intent.trim()}\n\nNext move: ${selected.nextMove}\nRequired evidence: ${selected.evidenceNeeded}`,
    source: 'doctrine',
  }
}
