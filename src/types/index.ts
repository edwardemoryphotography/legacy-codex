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
