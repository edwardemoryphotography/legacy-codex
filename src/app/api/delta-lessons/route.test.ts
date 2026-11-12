/** @vitest-environment node */
// TEST-ONLY SIMULATION. Nothing in this file is evidence of learning, of an
// owner confirmation, or of production behaviour. The mission id is made up,
// sign-in is stubbed, and the "ledger" is an array that imitates one database
// rule (unique user + idempotency key). It checks only that the route's own
// branching is self-consistent. Evidence from real sources lives in
// src/lib/incidentSources.real.test.ts and docs/boomerangs/COVERAGE.md.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { INCIDENT_CANDIDATES } from '@/lib/incidentCandidates'

type Row = Record<string, unknown>
const ledger: { missions: Row[]; mission_events: Row[] } = { missions: [], mission_events: [] }
const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn() }))

vi.mock('@supabase/server/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@supabase/server/core')>()), verifyAuth: mocks.verifyAuth,
}))
vi.mock('@/lib/projectReviewServer', () => ({
  loadProjectContext: vi.fn(),
  projectUserClient: () => ({ from: (table: 'missions' | 'mission_events') => {
    const tests: Array<(row: Row) => boolean> = []
    const rows = () => ledger[table].filter(row => tests.every(test => test(row)))
    const query = {
      select: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { tests.push(row => row[key] === value); return query },
      like: (key: string, pattern: string) => { tests.push(row => String(row[key]).startsWith(pattern.replace(/%$/, ''))); return query },
      in: (key: string, values: unknown[]) => { tests.push(row => values.includes(row[key])); return query },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: rows()[0] ? null : new Error('none') }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
      insert: async (row: Row) => {
        if (ledger[table].some(prior => prior.user_id === row.user_id && prior.idempotency_key === row.idempotency_key)) return { error: { code: '23505' } }
        ledger[table].push({ id: `00000000-0000-4000-8000-${String(ledger[table].length).padStart(12, '0')}`, created_at: new Date().toISOString(), ...row })
        return { error: null }
      },
    }
    return query
  } }),
}))
vi.mock('@/lib/projectReviewStore', () => ({ cachedProjectReview: vi.fn(), projectIsReviewable: vi.fn() }))

import { GET, POST } from './route'

const MISSION = '22222222-2222-4222-8222-222222222222' // made up; no such mission exists anywhere
const OTHER = '33333333-3333-4333-8333-333333333333' // made up
const candidate = INCIDENT_CANDIDATES[0]
const words = { rule: candidate.proposedRule, whenToApply: candidate.whenToApply, exceptions: candidate.exceptions, scope: 'account' }
const post = (body: object) => POST(new NextRequest('https://legacy-codex.vercel.app/api/delta-lessons', {
  method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
const state = async () => (await (await GET(new NextRequest('https://legacy-codex.vercel.app/api/delta-lessons', { headers: { Authorization: 'Bearer token' } }))).json()).candidates[0]

describe('SIMULATION (not evidence): /api/delta-lessons incident branching', () => {
  beforeEach(() => {
    ledger.missions = [{ id: MISSION, user_id: 'owner' }]
    ledger.mission_events = []
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://pkydkbuodikttfeawqsw.supabase.co')
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', 'owner')
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'owner' } }, error: null })
  })

  it('starts as proposed and writes nothing until the owner acts', async () => {
    expect(await state()).toMatchObject({ id: 'IC-001', state: 'proposed', lessonId: null })
    expect(ledger.mission_events).toHaveLength(0)
  })

  it('refuses anyone who is not the owner before reading or writing', async () => {
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'visitor' } }, error: null })
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })).status).toBe(403)
    expect(ledger.mission_events).toHaveLength(0)
  })

  it('rejects an invented candidate, another account’s mission, and a rule without exceptions', async () => {
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-999', missionId: MISSION, ...words })).status).toBe(400)
    ledger.missions = [{ id: MISSION, user_id: 'someone-else' }]
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })).status).toBe(404)
    ledger.missions = [{ id: MISSION, user_id: 'owner' }]
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words, exceptions: ' ' })).status).toBe(400)
    expect(ledger.mission_events).toHaveLength(0)
  })

  it('records the owner’s words with server-side sources, is idempotent, and allows only one active rule', async () => {
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words, sourceRefs: [{ id: 'x', url: 'https://example.com' }] })).status).toBe(200)
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })).status).toBe(200)
    expect(ledger.mission_events).toHaveLength(1)
    const detail = JSON.parse(ledger.mission_events[0].detail as string)
    expect(detail).toMatchObject({ origin: 'incident', candidateId: 'IC-001', mechanism: candidate.mechanism, exceptions: candidate.exceptions, ownerEdited: false, scope: 'account' })
    expect(detail.sourceRefs.map((ref: { url: string }) => ref.url)).toEqual(candidate.sources.map(source => source.url))
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words, rule: 'Different words.' })).status).toBe(409)
    expect(await state()).toMatchObject({ state: 'confirmed' })
  })

  it('keeps history, and lets a retired rule be confirmed again in the same words', async () => {
    await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })
    const lessonId = (await state()).lessonId
    expect((await post({ action: 'reject_incident', candidateId: 'IC-001', missionId: MISSION })).status).toBe(409)
    expect((await post({ action: 'retire', lessonId })).status).toBe(200)
    expect(await state()).toMatchObject({ state: 'retired', lessonId: null, generation: 1 })
    expect((await post({ action: 'reject_incident', candidateId: 'IC-001', missionId: MISSION, reason: 'Two attempts is too few.' })).status).toBe(200)
    expect(await state()).toMatchObject({ state: 'rejected' })
    expect((await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })).status).toBe(200)
    expect(await state()).toMatchObject({ state: 'confirmed', generation: 3 })
    expect(ledger.mission_events.map(row => row.type)).toEqual(['delta_lesson_confirmed', 'delta_lesson_retired', 'delta_lesson_candidate_rejected', 'delta_lesson_confirmed'])
    const [first, , , second] = ledger.mission_events.map(row => JSON.parse(row.detail as string))
    expect(second.rule).toBe(first.rule)
  })

  it('lets only one of two simultaneous confirmations with different words or missions stand', async () => {
    ledger.missions.push({ id: OTHER, user_id: 'owner' })
    const results = await Promise.all([
      post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words }),
      post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words, rule: 'Different words.' }),
      post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: OTHER, ...words }),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409, 409])
    expect(ledger.mission_events.filter(row => row.type === 'delta_lesson_confirmed')).toHaveLength(1)
  })

  it('never stores both a rejection and a confirmation for the same slot', async () => {
    const results = await Promise.all([
      post({ action: 'reject_incident', candidateId: 'IC-001', missionId: MISSION }),
      post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words }),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 409])
    expect(ledger.mission_events).toHaveLength(1)
    expect((await state()).state).toBe(ledger.mission_events[0].type === 'delta_lesson_confirmed' ? 'confirmed' : 'rejected')
    expect((await post({ action: 'reject_incident', candidateId: 'IC-001', missionId: MISSION })).status).toBe(ledger.mission_events[0].type === 'delta_lesson_confirmed' ? 409 : 200)
    expect(ledger.mission_events).toHaveLength(1)
  })

  it('keeps one account’s confirmation out of another account’s state', async () => {
    await post({ action: 'confirm_incident', candidateId: 'IC-001', missionId: MISSION, ...words })
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', 'second')
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'second' } }, error: null })
    expect(await state()).toMatchObject({ state: 'proposed', generation: 0 })
  })
})
