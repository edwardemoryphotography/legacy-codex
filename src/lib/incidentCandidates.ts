import type { BoomerangCase } from './boomerangCasebook'

// Source-backed lesson CANDIDATES reconstructed from real incidents. A record
// here is a proposal the owner can correct, reject or confirm. It is never a
// confirmed rule, never model context, and never proof of transfer. Only
// public, inspectable sources are stored; private transcripts stay private.

export type EvidenceLayer =
  | 'observedSourceFact' | 'historicalInterpretation' | 'crossDomainHypothesis'
  | 'implementedGuard' | 'userVerifiedIncident' | 'independentFutureTransfer'

export const EVIDENCE_LAYER_LABELS: Record<EvidenceLayer, string> = {
  observedSourceFact: 'Observed source fact',
  historicalInterpretation: 'Historical interpretation',
  crossDomainHypothesis: 'Cross-domain hypothesis',
  implementedGuard: 'Implemented guard',
  userVerifiedIncident: 'User-verified incident',
  independentFutureTransfer: 'Independently observed future transfer',
}

// Six separate statements. They are deliberately never folded into one
// confidence number: a strong source does not strengthen a weak bridge.
export type EvidenceLayers = Record<EvidenceLayer, string>

export function casebookEvidenceLayers(record: BoomerangCase): EvidenceLayers {
  const publicSources = record.sources.filter(source => source.access === 'public').length
  const restricted = record.sources.length - publicSources
  return {
    observedSourceFact: publicSources
      ? `${publicSources} public source${publicSources === 1 ? '' : 's'} resolve${publicSources === 1 ? 's' : ''}${restricted ? `; ${restricted} restricted origin record${restricted === 1 ? '' : 's'} not republished` : ''}. A resolving link shows the source exists, not that it supports every sentence here.`
      : 'Restricted origin records only; nothing here can be checked from public sources.',
    historicalInterpretation: 'The shared structure and reasoning bridge are a November 2026 reconstruction, written after the events.',
    crossDomainHypothesis: 'The target domain is a proposed application. No disconfirming test has been run.',
    implementedGuard: record.recordStatus === 'engineering-documented' || record.recordStatus === 'user-verified-fix'
      ? 'The cited code or record exists. Whether it enforces this rule at runtime is not established by this entry.'
      : 'None recorded.',
    userVerifiedIncident: record.recordStatus === 'user-verified-fix'
      ? 'Owner-reported acceptance of the specific fix. See the incident candidate for what is and is not publicly inspectable.'
      : 'None recorded.',
    independentFutureTransfer: 'Not demonstrated.',
  }
}

export function renderEvidenceLayers(layers: EvidenceLayers): string {
  return (Object.keys(EVIDENCE_LAYER_LABELS) as EvidenceLayer[])
    .map(key => `- **${EVIDENCE_LAYER_LABELS[key]}:** ${layers[key]}`).join('\n')
}

// A mechanism is a structural precondition that can be checked against saved
// project records, independent of vocabulary. Add one only with a real incident.
export const LESSON_MECHANISMS = ['repeated-local-fix-failure'] as const
export type LessonMechanism = typeof LESSON_MECHANISMS[number]

export interface IncidentSource { id: string; label: string; url: string; status: string }
export interface IncidentAttempt { sourceId: string; observedAt: string; approach: string; observedOutcome: string }

export interface IncidentCandidate {
  id: string
  casebookId: string
  title: string
  reconstructedAt: string
  problem: string
  attempts: readonly IncidentAttempt[]
  outcome: string
  contradictions: readonly string[]
  competingExplanations: readonly string[]
  mechanism: LessonMechanism
  rootMechanism: string
  bridge: string
  proposedRule: string
  whenToApply: string
  exceptions: string
  counterevidence: readonly string[]
  layers: EvidenceLayers
  sources: readonly IncidentSource[]
}

const PR = (n: number) => `https://github.com/edwardemoryphotography/legacy-codex/pull/${n}`

export const INCIDENT_CANDIDATES: readonly IncidentCandidate[] = [
  {
    id: 'IC-001',
    casebookId: 'BR-034',
    title: 'iPhone tools menu: two offset patches, then a structural replacement',
    reconstructedAt: '2026-11-10',
    problem: 'On the owner’s iPhone the Home tools menu was clipped and the Ask Codex composer was displaced when the keyboard opened, differently in the home-screen app and in ChatGPT’s embedded browser.',
    attempts: [
      { sourceId: 'pr:185', observedAt: '2026-11-10T04:06:40Z',
        approach: 'Tracked visualViewport resize and scroll offsets and compacted the Home surface while typing.',
        observedOutcome: 'PR #186 records that after this was live the composer vanished in the embedded browser and the tools sheet was still clipped.' },
      { sourceId: 'pr:186', observedAt: '2026-11-10T06:33:37Z',
        approach: 'Re-derived the dock inset from layout and visual viewport heights and released overflow clipping in typing mode.',
        observedOutcome: 'PR #187 records new owner screenshots showing two tools-menu options still cut off.' },
      { sourceId: 'pr:187', observedAt: '2026-11-10T06:53:59Z',
        approach: 'Replaced the absolutely positioned flyout with a native modal <dialog>, which the browser draws in its top layer outside the clipping ancestors.',
        observedOutcome: 'Owner reported the fix accepted on the real iPhone (stated in PR #188 and in the owner’s November 10 build directive).' },
    ],
    outcome: 'The menu stopped being clipped once it no longer lived inside the clipped, transformed dock. Offset arithmetic never removed that containment.',
    contradictions: [
      'The casebook entry BR-034 says three attempts to patch the flyout failed. The PRs show two offset patches aimed mainly at the keyboard and composer, then one structural replacement that worked.',
      'PR #187’s own description says iPhone acceptance was still outstanding when it was written. The acceptance is the owner’s later report, not an artifact inside that PR.',
    ],
    competingExplanations: [
      'The first two patches targeted a different symptom (keyboard displacement), so they may not count as failed attempts at the menu at all.',
      'The dialog may have worked because of its opaque sheet and explicit sizing rather than the top layer; the PRs do not isolate which change mattered.',
    ],
    mechanism: 'repeated-local-fix-failure',
    rootMechanism: 'The symptom was produced by a containing relationship (a positioned child inside clipped, transformed ancestors). Adjusting the child’s numbers left the relationship intact, so the symptom returned in each new context.',
    bridge: 'Any system where a part keeps failing after local adjustments may be failing because of what contains it. The move is to name the container relationship and replace it, not to tune the part again.',
    proposedRule: 'When repeated symptom patches fail, stop patching. Inspect the containing architecture and replace the invalid structural relationship with the smallest structural change that removes it.',
    whenToApply: 'At least two real attempts at the same symptom have failed or it returned in a new context, and you can name what contains the failing part.',
    exceptions: 'Does not apply to a first failure, to failures with different independent causes, or when no container relationship can be named. A structural replacement costs more than a patch; if one targeted fix has not been tried, try it first. It may be wrong when the earlier attempts were aimed at a different symptom.',
    counterevidence: [
      'One incident in one codebase. No second case has been examined.',
      'No unrelated task has yet been decided differently because of this rule.',
    ],
    layers: {
      observedSourceFact: 'PRs #185, #186 and #187 are merged; their descriptions record the screenshots, the offset approaches and the dialog replacement.',
      historicalInterpretation: 'Reading the three PRs as one arc (“patches failed, structure fixed it”) is a reconstruction written on November 10, 2026.',
      crossDomainHypothesis: 'That the same rule helps outside CSS layout is untested.',
      implementedGuard: 'None. No test or check enforces this rule; HomeTab tests cover only the dialog itself.',
      userVerifiedIncident: 'Owner-reported iPhone acceptance of the final fix. No screenshot or device record of the accepted state is in the public repository.',
      independentFutureTransfer: 'Not demonstrated.',
    },
    sources: [
      { id: 'pr:185', label: 'PR #185 — keyboard overlay and composer', url: PR(185), status: 'Merged PR; its description is the builder’s account, not independent verification' },
      { id: 'pr:186', label: 'PR #186 — embedded browser composer', url: PR(186), status: 'Merged PR; its description is the builder’s account, not independent verification' },
      { id: 'pr:187', label: 'PR #187 — native modal for the tools menu', url: PR(187), status: 'Merged PR; owner acceptance reported afterwards' },
    ],
  },
] as const

// Where the owner's own ledger says a candidate stands. Derived, never stored.
export type CandidateState = { id: string; state: 'proposed' | 'confirmed' | 'retired' | 'rejected'; lessonId: string | null; at: string | null }

export function findIncidentCandidate(id: unknown): IncidentCandidate | null {
  return typeof id === 'string' ? INCIDENT_CANDIDATES.find(candidate => candidate.id === id) ?? null : null
}

export function renderIncidentCandidate(candidate: IncidentCandidate): string {
  const source = (id: string) => candidate.sources.find(item => item.id === id)
  return [
    `### Incident candidate ${candidate.id} — ${candidate.title}`,
    '',
    '**Status:** proposed lesson, not confirmed. Open Mission → “Lessons from real incidents” to correct, reject or confirm it.',
    '',
    `**Original problem:** ${candidate.problem}`,
    '',
    '**Attempts and observed outcomes:**',
    ...candidate.attempts.map((attempt, index) => `${index + 1}. [${source(attempt.sourceId)?.label}](${source(attempt.sourceId)?.url}) (${attempt.observedAt.slice(0, 10)}) — ${attempt.approach} *Outcome:* ${attempt.observedOutcome}`),
    '',
    `**Root mechanism (proposed):** ${candidate.rootMechanism}`,
    '',
    `**Bridge (proposed):** ${candidate.bridge}`,
    '',
    `**Proposed rule:** ${candidate.proposedRule}`,
    '',
    `**When to apply:** ${candidate.whenToApply}`,
    '',
    `**Exceptions:** ${candidate.exceptions}`,
    '',
    '**Contradictions in the record:**',
    ...candidate.contradictions.map(item => `- ${item}`),
    '',
    '**Competing explanations:**',
    ...candidate.competingExplanations.map(item => `- ${item}`),
    '',
    '**Counterevidence and gaps:**',
    ...candidate.counterevidence.map(item => `- ${item}`),
    '',
    '**Evidence, layer by layer:**',
    renderEvidenceLayers(candidate.layers),
  ].join('\n')
}

// Counts come from the target project's own saved rows, read under RLS.
export interface StructuralSignals { corrections: number; suppliedSteps: number; hasBlocker: boolean }

// Vocabulary-independent check of a mechanism's precondition. A match is a
// reason to investigate the rule, never proof that it applies.
export function mechanismPrecondition(mechanism: LessonMechanism, signals: StructuralSignals): { observed: boolean; basis: string } {
  if (mechanism !== 'repeated-local-fix-failure') return { observed: false, basis: 'Unknown mechanism; precondition not evaluated.' }
  const observed = signals.corrections >= 2 || (signals.hasBlocker && signals.corrections + signals.suppliedSteps >= 3)
  const counted = `${signals.corrections} saved correction${signals.corrections === 1 ? '' : 's'}, ${signals.suppliedSteps} supplied step${signals.suppliedSteps === 1 ? '' : 's'}, blocker ${signals.hasBlocker ? 'present' : 'absent'}`
  return { observed, basis: observed
    ? `Structural precondition observed in this project’s saved history (${counted}). Investigate whether the rule applies; this is not proof.`
    : `Structural precondition not observed in this project’s saved history (${counted}). Apply only if the supplied sources show repeated failed attempts.` }
}
