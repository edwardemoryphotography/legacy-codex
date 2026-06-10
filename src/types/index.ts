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
