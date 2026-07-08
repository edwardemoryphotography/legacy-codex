import type { Principle, Protocol, ValidationMetric } from '@/types'

export const CANONICAL_PRINCIPLES: Principle[] = [
  {
    id: 'artifact-anchoring',
    number: 1,
    name: 'Artifact Anchoring',
    description: 'Every interaction must yield a tangible system change or file.',
  },
  {
    id: 'interruption-resilience',
    number: 2,
    name: 'Interruption Resilience',
    description: 'Systems must be stateless enough to survive pauses.',
  },
  {
    id: 'governing-law',
    number: 3,
    name: 'Governing Law',
    description: 'The system is the authority, not the user\'s fluctuating energy.',
  },
  {
    id: 'constraint-discipline',
    number: 4,
    name: 'Constraint Discipline',
    description: 'Prefer modifying existing infrastructure over proposing new tools.',
  },
]

export const PROTOCOLS: Protocol[] = [
  {
    id: 'smallest-ship',
    number: 1,
    title: 'The Smallest Ship',
    trigger: 'Ambiguity detected',
    output: 'Smallest shippable artifact',
  },
  {
    id: 'pre-friction-triage',
    number: 2,
    title: 'Pre-Friction Triage',
    trigger: 'Execution stall >15m',
    output: 'Identification of 1 blocker',
  },
  {
    id: 'constraint-decay',
    number: 3,
    title: 'Constraint Decay',
    trigger: 'Blocker >48 hours',
    output: 'Automatic purge or 180-pivot',
  },
  {
    id: 'tech-stack-mandate',
    number: 4,
    title: 'Tech Stack Mandate',
    trigger: 'New tool proposed',
    output: 'Reject unless Sony/Apple/Muse/Docker',
  },
  {
    id: 'failure-validation',
    number: 5,
    title: 'Failure Validation',
    trigger: 'Edward says "doesn\'t work"',
    output: '5-step debug checklist',
    steps: [
      'Artifact defined?',
      'Blocker named?',
      'Tool or constraint failure?',
      'Smallest reproducible test?',
      '180-pivot if unfixable in 15min?',
    ],
  },
]

export const VALIDATION_METRICS: ValidationMetric[] = [
  {
    id: 'artifact_existence',
    label: 'Artifact Existence',
    sublabel: 'Does a thing exist post-turn?',
  },
  {
    id: 'stateless_resumption',
    label: 'Stateless Resumption',
    sublabel: 'Can Edward resume from a transcript link?',
  },
  {
    id: 'subtraction_check',
    label: 'Subtraction Check',
    sublabel: 'Did this turn remove or simplify a step?',
  },
]

// ─── Constraint validator term sets ───────────────────────────
export const CONSTRAINT_TERMS = {
  artifact: [
    'file', 'repo', 'commit', 'deploy', 'url', 'dashboard',
    'html', 'markdown', 'doc', 'publish', 'ship', 'build', 'export', 'artifact',
  ],
  resilience: [
    'resumption', 'resume', 'next action', 'blocker', 'checkpoint',
    'log', 'transcript', 'handoff', 'stateless', 'continue',
  ],
  governing: [
    'system', 'authority', 'protocol', 'constraint', 'rule', 'policy', 'checklist', 'validate',
  ],
  existingInfra: [
    'existing', 'current', 'reuse', 'modify', 'simplify', 'remove', 'prune', 'within this repo',
  ],
  newTool: [
    'new tool', 'new stack', 'new framework', 'switch to', 'rewrite in', 'start over',
  ],
}

export const SPRINT_TERMS = {
  artifact: [
    'file', 'repo', 'commit', 'deploy', 'url', 'dashboard',
    'html', 'markdown', 'doc', 'publish', 'ship', 'build', 'export',
  ],
  mindset: [
    'motivation', 'mindset', 'habit', 'feel', 'inspiration',
    'confidence', 'affirmation',
  ],
}
