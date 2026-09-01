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
  // so these need no migration; the table stays the append-only ledger for
  // predictions, acceptances, and corrections alike.
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
  | 'no_finish_line'
  | 'displaces_primary'
  | 'lower_leverage'

export type DeltaEvidenceState = 'none' | 'verified' | 'conflict' | 'stale' | 'unverified'

export interface DeltaCandidate {
  id: string
  move: string
  missionId: string | null
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
  reason: string
  createdAt: string
}

export interface StrategicDelta {
  /** The single move. */
  move: string
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
  /** The context sources actually used — counts, never claims. */
  assembledFrom: string[]
  computedAt: string
}
