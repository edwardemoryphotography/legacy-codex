import type { DeltaCorrection, Mission, StrategicDelta } from '@/types'
import type { HomeContinueView } from './homeContinue'
import type { ProjectReview } from './projectReview'
import { operationsEquivalent } from './operationEquivalence'
import { humanizeSourceText } from './readableProvenance'
import { reviewCandidate } from './reviewedDelta'
import type { SavedActionSnapshot } from './nextAction'

/** A recommendation can change while the commitment and its return note retain their identity. */
export function homeDecision(view: HomeContinueView, mission: Mission, saved: SavedActionSnapshot | null,
  delta: StrategicDelta, review: ProjectReview | null, corrections: DeltaCorrection[], staleAcceptance: string | null = null) {
  const reviewed = review && (delta.provenance === 'model' && delta.candidateId === reviewCandidate(review)?.id ||
    review.decision === 'clarify' && delta.candidateId === `project:${mission.id}` && delta.move === review.clarification) ? review : null
  const humanize = (value: string) => reviewed ? humanizeSourceText(value, reviewed.sources) : value
  const constrained = ['primary_blocked', 'primary_capacity_mismatch', 'evidence_conflict'].includes(delta.situation)
  const sameAction = saved && saved.missionId === delta.missionId && saved.title.trim() === delta.move.trim()
  const resume = reviewed?.decision === 'resume' && sameAction && reviewed.resumeActionId === saved.id
  const rejected = [...corrections].reverse().find(c => c.missionId === mission.id && view.stepTitle &&
    (c.correctedMove === view.stepTitle || operationsEquivalent(c.correctedMove, view.stepTitle)))
  const commitmentLeads = saved && !rejected && !constrained && (resume || (!reviewed && (delta.provenance !== 'supplied' || sameAction)))
  const acceptedLeads = !saved && view.status === 'accepted' && !staleAcceptance && !rejected && !constrained && !reviewed && delta.provenance !== 'supplied'
  const finishEvidenceAlternative = commitmentLeads && !reviewed && delta.candidateId === `produce-evidence:${mission.id}`
  const reasons = [...view.reasons]
  const specific = (reviewed?.unknowns[0] ? humanize(reviewed.unknowns[0]) : null) || (finishEvidenceAlternative
    ? `If this proof is already available, check it before continuing: ${mission.evidenceRequirement}`
    : commitmentLeads || acceptedLeads
    ? 'A blocker, conflicting evidence, or a correction to this step would change the recommendation.'
    : delta.wouldChangeIf)
  if (staleAcceptance) reasons.push({ label: 'What changed', text: staleAcceptance })
  if (rejected) reasons.push({ label: 'Your reason for setting this move aside', text: rejected.reason })
  if (specific) reasons.push({ label: 'What would change this move', text: specific })
  if (reviewed) {
    if (reviewed.workDraft) reasons.push({ label: 'Draft to work from', text: humanize(reviewed.workDraft) })
    if (reviewed.finishWhen) reasons.push({ label: 'Finish this move when', text: humanize(reviewed.finishWhen) })
    for (const alt of reviewed.alternatives) reasons.push({ label: humanize(alt.operation), text: humanize(alt.whyNot) })
    if (reviewed.structuralBridge) {
      const bridge = reviewed.structuralBridge
      reasons.push({ label: 'Possible connection', text: [reviewed.sources.find(s => s.id === bridge.priorSourceId)?.label, bridge.priorQuote, reviewed.sources.find(s => s.id === bridge.currentSourceId)?.label, bridge.currentQuote, humanize(bridge.sharedStructure), humanize(bridge.reasoningBridge), humanize(bridge.application), humanize(bridge.proofRequired)].filter(Boolean).join('\n') })
    }
  }
  const finishWhen = reviewed?.finishWhen ? humanize(reviewed.finishWhen) : null
  if (commitmentLeads || acceptedLeads) {
    const why = (reviewed?.why ? humanize(reviewed.why) : null) ?? (acceptedLeads ? 'You accepted this suggestion. The recorded constraints give no reason to set it aside.' :
      finishEvidenceAlternative
        ? `You ${saved?.status === 'IN_PROGRESS' ? 'started' : 'saved'} this step. The alternative is to collect the mission’s finish evidence. Your action is still open, so resume here unless that proof is already available.`
        : sameAction && saved?.status === 'IN_PROGRESS'
        ? 'The step from your project context matches the action already in progress. Resume from your saved starting point.'
        : 'You already chose this step. The available mission records give no higher-priority reason to interrupt it.')
    if (!reviewed && delta.move !== view.stepTitle) reasons.push({ label: 'Also considered', text: delta.move })
    return { view: { ...view, reasons, cta: saved?.status === 'TODO' ? 'Open this saved step' : view.cta }, why, finishWhen, followsSaved: Boolean(saved), correction: { missionId: mission.id, move: view.stepTitle!, candidateId: resume ? delta.candidateId : null }, reviewed }
  }
  if (saved) reasons.unshift({ label: 'Your existing commitment', text: saved.title })
  else if (view.status === 'accepted' && view.stepTitle) reasons.unshift({ label: 'Previously accepted', text: view.stepTitle })
  const question = delta.provenance === 'insufficient_context'
  // The capacity report belongs to the Primary. When the engine defers the
  // Primary and clarifies the Secondary, keep the Secondary's actual missing
  // input instead of replacing it with the Primary's capacity question.
  const capacityGap = question && delta.situation === 'primary_capacity_mismatch' && delta.missionId === mission.id
  const title = capacityGap ? 'What smaller step fits your available capacity?' : humanize(delta.move)
  const why = (reviewed?.why ? humanize(reviewed.why) : null) ?? (capacityGap ? 'You reported that the Primary mission exceeds your capacity.' : delta.because)
  return {
    view: { ...view, reasons: reasons.filter(reason => reason.label !== 'Where this step came from'), status: question ? 'clarify' as const : 'suggested' as const,
      stepTitle: title, stepLabel: delta.missionId && delta.missionId !== mission.id ? `Next move on ${delta.missionTitle}` : question ? 'One thing to clarify' : reviewed ? 'Project review · proposed move' : 'Suggested next move',
      cta: question ? 'Clarify in Mission' : 'Work on this in Mission' },
    why, finishWhen, followsSaved: false, correction: !question && delta.missionId ? { missionId: delta.missionId, move: delta.move, candidateId: delta.candidateId } : null, reviewed,
  }
}
