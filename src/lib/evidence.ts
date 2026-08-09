// Pure functions for the evidence bridge contract — mirrors biometrics.ts's
// shape: an external process writes public/notes/evidence-snapshot.json, this
// module validates and parses it, and the UI has no opinion on how the file
// was produced. No mock values, fixtures, or fallbacks — a missing or
// malformed file produces an explicit error, never a guessed value.

import type { EvidenceKind, EvidenceRecord, EvidenceStatus } from '@/types'

// A snapshot older than this is shown as stale rather than trusted silently
// (spec §8: "If a source is unreachable, preserve the last verified state
// and show its timestamp and stale status").
export const STALE_AFTER_HOURS = 24

const VALID_KINDS: EvidenceKind[] = ['merged_pr', 'live_deployment', 'published_artifact', 'confirmed_action', 'custom']
const VALID_STATUSES: EvidenceStatus[] = ['verified', 'unverified', 'conflict', 'stale']

export function isValidEvidenceRecord(row: unknown): row is EvidenceRecord {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    (r.missionId === null || typeof r.missionId === 'string') &&
    typeof r.source === 'string' &&
    r.source.trim().length > 0 &&
    typeof r.kind === 'string' &&
    VALID_KINDS.includes(r.kind as EvidenceKind) &&
    typeof r.status === 'string' &&
    VALID_STATUSES.includes(r.status as EvidenceStatus) &&
    typeof r.claim === 'string' &&
    typeof r.observedAt === 'string' &&
    !Number.isNaN(Date.parse(r.observedAt)) &&
    typeof r.fetchedAt === 'string' &&
    !Number.isNaN(Date.parse(r.fetchedAt))
  )
}

export type EvidenceSnapshot = { generatedAt: string; records: EvidenceRecord[] }
export type EvidenceParseResult = EvidenceSnapshot | { error: string }

export function parseEvidenceSnapshot(raw: string): EvidenceParseResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: '/notes/evidence-snapshot.json is not valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: '/notes/evidence-snapshot.json must be a { generatedAt, records } object.' }
  }

  const record = parsed as Record<string, unknown>
  const generatedAt = typeof record.generatedAt === 'string' ? record.generatedAt : null
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    return { error: '/notes/evidence-snapshot.json is missing a valid generatedAt timestamp.' }
  }

  const candidate = Array.isArray(record.records) ? record.records : []
  const records = candidate.filter(isValidEvidenceRecord)

  if (!records.length && candidate.length) {
    return { error: '/notes/evidence-snapshot.json has records, but none match the required evidence shape.' }
  }

  return { generatedAt, records }
}

// Two records for the same mission with different statuses/claims from
// different sources must be surfaced separately, never merged (spec §8:
// "If Notion and GitHub conflict, show both claims; do not silently merge
// them"). This groups by missionId so the UI can render each source's claim.
export function groupByMission(records: EvidenceRecord[]): Map<string | null, EvidenceRecord[]> {
  const groups = new Map<string | null, EvidenceRecord[]>()
  for (const rec of records) {
    const list = groups.get(rec.missionId) ?? []
    list.push(rec)
    groups.set(rec.missionId, list)
  }
  return groups
}

// True conflict = a record explicitly flagged 'conflict', or two sources for
// the same mission disagree — one calls it verified, another doesn't.
export function hasConflict(records: EvidenceRecord[]): boolean {
  if (records.some(r => r.status === 'conflict')) return true
  const distinctStatuses = new Set(records.map(r => r.status))
  return distinctStatuses.has('verified') && distinctStatuses.size > 1
}

export function isStale(fetchedAt: string, now: string, staleAfterHours: number = STALE_AFTER_HOURS): boolean {
  const fetchedMs = Date.parse(fetchedAt)
  const nowMs = Date.parse(now)
  if (Number.isNaN(fetchedMs) || Number.isNaN(nowMs)) return true
  return nowMs - fetchedMs > staleAfterHours * 60 * 60 * 1000
}
