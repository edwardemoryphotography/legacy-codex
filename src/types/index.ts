// ─── Canonical Principles ─────────────────────────────────────
export interface Principle {
  id: string
  number: number
  name: string
  description: string
}

// ─── Protocol ─────────────────────────────────────────────────
export interface Protocol {
  id: string
  number: number
  title: string
  trigger: string
  output: string
  steps?: string[]
}

// ─── Validation Metric ────────────────────────────────────────
export type MetricValue = 'PASS' | 'FAIL' | null

export interface ValidationMetric {
  id: string
  label: string
  sublabel: string
}

// ─── Biometrics ───────────────────────────────────────────────
export interface BiometricDay {
  date: string
  sleepHours: number
  recoveryScore: number
  focusScore: number
}

export type BiometricMode =
  | 'deep_build'
  | 'creative_edit'
  | 'admin_light'
  | 'recovery'

export interface BiometricSummary {
  readiness: number
  recovery: number
  focus: number
  sleepDebt: number
  mode: BiometricMode
  recommendation: string
  source: string
  days: BiometricDay[]
}

// ─── Codex Knowledge Graph ────────────────────────────────────
export type SectionKey =
  | 'root'
  | 'council'
  | 'territory'
  | 'artistic'
  | 'neuro'
  | 'automation'
  | 'business'
  | 'personalos'
  | 'convergence'

export interface CodexEntry {
  id: string
  title: string
  path: string
  section: SectionKey
  category?: string
  tags?: string[]
  content: string
  children?: CodexEntry[]
}

export interface CodexSection {
  key: SectionKey
  label: string
  emoji?: string
  color: string
  description: string
  entries: CodexEntry[]
}

// ─── Tab IDs ──────────────────────────────────────────────────
export type TabId =
  | 'mission'
  | 'overview'
  | 'protocols'
  | 'sprint-linker'
  | 'resumption-log'
  | 'biometrics'
  | 'constraint-validator'
  | 'codex'
  | 'controls'

export interface UIPrefs {
  density: 'compact' | 'comfortable'
  fontScale: number
  highContrast: boolean
  reducedMotion: boolean
}

export interface CaptureItem {
  id: string
  text: string
  timestamp: string
  suggested?: string
}

// ─── Mission Loop ─────────────────────────────────────────────
export type MissionState =
  | 'candidate'
  | 'parked'
  | 'primary'
  | 'secondary'
  | 'blocked'
  | 'completed'
  | 'paused'
  | 'abandoned'

// Self-reported only — never inferred from biometrics or behavior (spec §5).
export type CapacityLevel = 'low' | 'medium' | 'high'

export interface Mission {
  id: string
  title: string
  why: string
  finishLine: string | null
  evidenceRequirement: string | null
  state: MissionState
  blocker: string | null
  // True once Edward has explicitly reported the Primary doesn't fit his
  // current capacity — the only non-blocked path that makes Secondary
  // actionable (spec §5).
  capacityMismatch: boolean
  createdAt: string
  updatedAt: string
}

export type MissionEventType =
  | 'captured'
  | 'finish_line_set'
  | 'promoted_primary'
  | 'promoted_secondary'
  | 'blocked'
  | 'unblocked'
  | 'capacity_mismatch_reported'
  | 'priority_challenge_requested'
  | 'priority_challenge_applied'
  | 'completed'
  | 'paused'
  | 'abandoned'
  // Strategic Delta lifecycle. mission_events.type has no CHECK constraint,
  // so these need no migration. This remains a transitional, user-scoped
  // vertical-slice stream — not universal correction ownership.
  | 'delta_predicted'
  | 'delta_accepted'
  | 'delta_corrected'
  | 'delta_context_added'

export interface MissionEvent {
  id: string
  missionId: string
  type: MissionEventType
  detail: string
  createdAt: string
}

export type EvidenceKind =
  | 'merged_pr'
  | 'live_deployment'
  | 'published_artifact'
  | 'confirmed_action'
  | 'custom'

export type EvidenceStatus = 'verified' | 'unverified' | 'conflict' | 'stale'

export interface EvidenceRecord {
  id: string
  missionId: string | null
  source: string
  kind: EvidenceKind
  status: EvidenceStatus
  claim: string
  observedAt: string
  fetchedAt: string
}

// ─── Strategic Delta ──────────────────────────────────────────
// The predictive front door. A Delta is a *prediction*, never
// automatically an Action — see docs and src/lib/strategicDelta.ts.

// Three states the UI must always be able to tell apart (no fake
// intelligence): a rule-based prediction over real state, a
// model-generated prediction, and honestly having nothing to predict from.
// 'model' is reserved and rendered distinctly; no code path produces it yet.
export type DeltaProvenance = 'deterministic' | 'model' | 'insufficient_context'

// What kind of situation the current state is — historical LAR's job.
export type DeltaSituation =
  | 'evidence_conflict'
  | 'primary_blocked'
  // Primary is unblocked but the human explicitly reported it doesn't fit
  // their current capacity (spec §5's other route to an actionable
  // Secondary). Unlike a blocker, there is no "clear it" action — the
  // report itself is what makes the Secondary the move.
  | 'primary_capacity_mismatch'
  | 'primary_active'
  | 'no_primary_ready'
  | 'no_primary_unready'
  | 'empty'

// Why a candidate move was killed — historical REK's job. Inhibition
// reasons are structural, never motivational.
export type DeltaInhibitionReason =
  | 'corrected'
  | 'unverified_state'
  | 'blocked'
  // The human explicitly reported the Primary doesn't fit their current
  // capacity — distinct from `blocked`: no candidate survives this the way
  // clear_blocker survives a blocker, because there is no action that
  // un-reports a capacity mismatch.
  | 'capacity_mismatch'
  | 'no_finish_line'
  | 'displaces_primary'
  | 'lower_leverage'
  // The candidate restates the destination instead of naming a move. This
  // is the quality bar, not a preference — see `isConcreteMove`.
  | 'not_a_move'

export type DeltaEvidenceState = 'none' | 'verified' | 'conflict' | 'stale' | 'unverified'

// What a candidate proposes doing. Carried explicitly so inhibition rules
// read as rules rather than sniffing id prefixes.
export type DeltaCandidateKind =
  | 'reconcile_evidence'
  | 'clear_blocker'
  | 'name_evidence'
  | 'produce_evidence'
  | 'promote_to_primary'
  | 'set_finish_line'
  // A concrete operation for one finish-line clause, proposed by the
  // narrowly bounded model stage — never generated deterministically.
  // Runs through the exact same isConcreteMove gate and inhibition as
  // everything else; this only marks where the candidate came from.
  | 'model_suggested'
  // Kept so the human can see it was considered and rejected, never selected.
  | 'whole_mission'

export interface DeltaCandidate {
  id: string
  kind: DeltaCandidateKind
  move: string
  missionId: string | null
  /** Stable proof-target identity for clause-scoped operations. Distinct from
   *  `id`: rejecting one operation must not mark its proof target resolved. */
  targetId?: string
  /** Lower ranks are higher leverage. */
  rank: number
}

export interface InhibitedCandidate extends DeltaCandidate {
  reason: DeltaInhibitionReason
  explanation: string
}

// A recorded "Not right." The prior Delta is never erased — the
// correction is additive and feeds back in as an inhibition input.
export interface DeltaCorrection {
  id: string
  missionId: string
  correctedMove: string
  /** Candidate id the correction was recorded against, when known. Newer
   *  corrections carry it so a copy change cannot silently orphan them;
   *  older rows have only the prose and still match on `correctedMove`. */
  candidateId?: string
  reason: string
  createdAt: string
}

export interface DeltaProofStep {
  index: number
  text: string
  /** Candidate operations rejected for this still-unresolved target. A
   *  rejection is feedback about an operation, never proof of completion. */
  rejectedOperations: number
  /** True for the part this Delta is currently aimed at. */
  selected: boolean
}

export interface StrategicDelta {
  /** The single move. */
  move: string
  /** Id of the candidate this move came from, so a correction survives a
   *  later change to the move's wording. Null when nothing was selected. */
  candidateId: string | null
  provenance: DeltaProvenance
  situation: DeltaSituation
  missionId: string | null
  missionTitle: string | null
  /** Why this one. */
  because: string
  /** What is currently known, stated as fact. */
  currentReality: string
  /** What prevents progress, when something does. */
  blockingGap: string | null
  evidenceState: DeltaEvidenceState
  /** Alternatives considered and killed, with the reason each was killed. */
  inhibited: InhibitedCandidate[]
  /** The condition under which this recommendation should be recomputed. */
  wouldChangeIf: string
  /** The finish line broken into the parts it claims to prove, in the order
   *  the human wrote them, with the ones already corrected marked. Empty when
   *  the finish line does not decompose. */
  proofSteps: DeltaProofStep[]
  /** The context sources actually used — counts, never claims. */
  assembledFrom: string[]
  computedAt: string
}

// ─── Context-aware next move (local rules, no execution) ────────────────
export type ContextAvailability = 'loading' | 'ready' | 'unavailable'

export interface NextMoveContext {
  mission: Mission | null
  missionStatus: ContextAvailability
  evidence: EvidenceRecord[]
  evidenceStatus: ContextAvailability
}

export interface NextMoveRecommendation {
  reason: 'loading' | 'mission_unavailable' | 'no_primary' | 'inactive_mission'
    | 'blocker' | 'capacity' | 'finish_line' | 'evidence_unavailable'
    | 'evidence_invalid' | 'evidence_conflict' | 'evidence_stale'
    | 'evidence_unverified' | 'evidence_missing' | 'next_action'
  kind: 'question' | 'review'
  label: string
  nextMove: string
  why: string
  evidenceNeeded: string
  handoff: string
  source: 'local-rules'
}
