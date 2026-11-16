/** @vitest-environment node */
// TEST-ONLY SIMULATION. Nothing in this file is evidence of learning, of an
// owner confirmation, of a real mission, or of production behaviour. No owner
// has confirmed a casebook lesson and then run a Project Review as part of
// this work. Sign-in is stubbed, every mission id and mission title below is
// a made-up placeholder, and the "database" is an in-memory array that
// imitates only the query protocol the code under test uses.
//
// What IS real: the lesson content. Stored confirmations are produced by the
// actual /api/delta-lessons and /api/lesson-relay route code from the actual
// checked-in casebook (HISTORICAL_LESSON_CANDIDATES) and incident IC-001, then
// read back through the actual loadConfirmedLessons and loadProjectContext.
//
// What it checks: the mission a lesson is recorded under is a ledger anchor.
// It is the lesson's origin only for a Project Review confirmation (stored
// with no `origin` field). Review: PR #192 discussion_r4559482449.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { HISTORICAL_LESSON_CANDIDATES, reviewCandidateSources } from './historicalLessonCandidates'
import { INCIDENT_CANDIDATES } from './incidentCandidates'
import { encodeLessonRelay } from './lessonRelay'
import { formatLearnedContext } from './learnedContext'
import { loadConfirmedLessons } from './projectLessonsServer'
import type { ReviewProposal } from './projectReview'
import { measureTransfer, parseStructuralBridge, selectInvestigationProjects } from './structuralTransfer'

type Row = Record<string, unknown>
type Table = 'missions' | 'mission_events' | 'evidence_snapshots' | 'actions'
const db: Record<Table, Row[]> = { missions: [], mission_events: [], evidence_snapshots: [], actions: [] }
const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn() }))
let clock = 0
// Stored rows are stamped in the past, one second apart, so reads bounded by
// "now" see them and ordering is deterministic.
const stamp = () => new Date(Date.UTC(2026, 10, 1) + 1_000 * clock++).toISOString()

function fakeClient() {
  return { from(table: Table) {
    const tests: Array<(row: Row) => boolean> = []
    const sorts: Array<[string, boolean]> = []
    let window: [number, number] | null = null
    const rows = () => {
      const found = db[table].filter(row => tests.every(test => test(row)))
      for (const [key, ascending] of [...sorts].reverse()) {
        found.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1))
      }
      return window ? found.slice(window[0], window[1] + 1) : found
    }
    const query = {
      select: () => query, abortSignal: () => query,
      order: (key: string, options?: { ascending?: boolean }) => { sorts.push([key, options?.ascending !== false]); return query },
      limit: (count: number) => { window = [0, count - 1]; return query },
      range: (from: number, to: number) => { window = [from, to]; return query },
      eq: (key: string, value: unknown) => { tests.push(row => row[key] === value); return query },
      neq: (key: string, value: unknown) => { tests.push(row => row[key] !== value); return query },
      lte: (key: string, value: string) => { tests.push(row => String(row[key]) <= value); return query },
      gte: (key: string, value: string) => { tests.push(row => String(row[key]) >= value); return query },
      like: (key: string, pattern: string) => { tests.push(row => String(row[key]).startsWith(pattern.replace(/%$/, ''))); return query },
      in: (key: string, values: unknown[]) => { tests.push(row => values.includes(row[key])); return query },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      single: async () => ({ data: rows()[0] ?? null, error: rows()[0] ? null : new Error('none') }),
      then: (resolve: (value: { data: Row[]; error: null; count: number }) => unknown) => resolve({ data: rows(), error: null, count: rows().length }),
      insert: async (row: Row) => {
        if (db[table].some(prior => prior.user_id === row.user_id && prior.idempotency_key === row.idempotency_key)) return { error: { code: '23505' } }
        db[table].push({ id: `00000000-0000-4000-8000-${String(db[table].length).padStart(12, '0')}`, created_at: stamp(), ...row })
        return { error: null }
      },
    }
    return query
  } }
}

vi.mock('@supabase/server/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@supabase/server/core')>()), verifyAuth: mocks.verifyAuth,
}))
// Only the database client is replaced; loadProjectContext is the real one.
vi.mock('./projectReviewServer', async importOriginal => ({
  ...(await importOriginal<typeof import('./projectReviewServer')>()), projectUserClient: () => fakeClient(),
}))
vi.mock('@/lib/projectReviewStore', () => ({ cachedProjectReview: vi.fn(), projectIsReviewable: vi.fn() }))

import { POST as lessonsPost } from '@/app/api/delta-lessons/route'
import { POST as relayPost } from '@/app/api/lesson-relay/route'
import { loadProjectContext, projectUserClient } from './projectReviewServer'

// Made-up placeholder ids and titles. No such missions exist anywhere.
const id = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`
const TARGET = id(1), ANCHOR = id(2), ORIGIN = id(3), CORRECTED = id(4)
const VOCABULARY = [id(5), id(6), id(7), id(8)]
const mission = (missionId: string, title: string): Row => ({ id: missionId, user_id: 'owner', title, why: '', finish_line: null,
  evidence_requirement: null, state: 'candidate', blocker: null, capacity_mismatch: null, updated_at: stamp() })

const casebook = HISTORICAL_LESSON_CANDIDATES[0]
const incident = INCIDENT_CANDIDATES[0]
const client = () => projectUserClient('', '') as ReturnType<typeof projectUserClient>
const post = (handler: typeof lessonsPost, path: string, body: object) => handler(new NextRequest(`https://legacy-codex.vercel.app${path}`, {
  method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))

const confirmCasebook = (scope: 'account' | 'mission' = 'account') => post(lessonsPost, '/api/delta-lessons', {
  action: 'confirm_casebook', candidateId: casebook.id, missionId: ANCHOR, historicalReviewed: true,
  rule: casebook.proposedRule, whenToApply: casebook.whenToApply, exceptions: casebook.exceptions, scope })
const confirmIncident = () => post(lessonsPost, '/api/delta-lessons', {
  action: 'confirm_incident', candidateId: incident.id, missionId: ANCHOR,
  rule: incident.proposedRule, whenToApply: incident.whenToApply, exceptions: incident.exceptions, scope: 'account' })
const receiveRelay = () => post(relayPost, '/api/lesson-relay', { action: 'receive', missionId: ANCHOR, scope: 'account',
  code: encodeLessonRelay({ rule: incident.proposedRule, whenToApply: incident.whenToApply, exceptions: incident.exceptions }) })
// The shape the Project Review `confirm` action stores: no `origin` field.
// The rule words are placeholders; producing this row through the route would
// need a model-generated review, which this file must not fabricate.
function storeReviewConfirmation(missionId: string) {
  db.mission_events.push({ id: `00000000-0000-4000-9000-${String(db.mission_events.length).padStart(12, '0')}`, created_at: stamp(),
    user_id: 'owner', mission_id: missionId, type: 'delta_lesson_confirmed', idempotency_key: `lesson:confirm:placeholder-${missionId}`,
    detail: JSON.stringify({ rule: 'PLACEHOLDER rule words (simulation only).', whenToApply: 'PLACEHOLDER condition (simulation only).',
      scope: 'account', reviewedAt: stamp(), sourceIds: [`mission:${missionId}`],
      sourceRefs: [{ id: `mission:${missionId}`, label: 'Placeholder source', status: 'human-defined outcome' }] }) })
}

describe('SIMULATION (not evidence): a lesson’s ledger mission is not its origin', () => {
  beforeEach(() => {
    clock = 0
    db.missions = [mission(TARGET, 'Darkroom print portfolio'), mission(ANCHOR, 'Tax paperwork'),
      mission(ORIGIN, 'Garden irrigation'), mission(CORRECTED, 'Bicycle repair'),
      mission(VOCABULARY[0], 'Darkroom print inventory'), mission(VOCABULARY[1], 'Darkroom print pricing'),
      mission(VOCABULARY[2], 'Darkroom portfolio exhibit'), mission(VOCABULARY[3], 'Portfolio print website')]
    db.mission_events = []; db.evidence_snapshots = []; db.actions = []
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://pkydkbuodikttfeawqsw.supabase.co')
    vi.stubEnv('DELTA_OPERATION_ALLOWED_USER_ID', 'owner')
    mocks.verifyAuth.mockResolvedValue({ data: { userClaims: { id: 'owner' } }, error: null })
  })

  it('reloads a stored casebook confirmation with its rule, limits, scope and sources, and no origin', async () => {
    expect((await confirmCasebook()).status).toBe(200)
    const [lesson] = await loadConfirmedLessons(client(), 'owner', [])
    expect(lesson).toMatchObject({ rule: casebook.proposedRule, whenToApply: casebook.whenToApply, exceptions: casebook.exceptions,
      scope: 'account', origin: 'casebook', candidateId: casebook.id, mechanism: casebook.record.sharedStructure,
      sourceRefs: reviewCandidateSources(casebook) })
    // The ledger association is kept for ownership, mission scope and retirement.
    expect(lesson.missionId).toBe(ANCHOR)
    expect(lesson.originMissionId).toBeNull()
  })

  it('treats incident, Relay and unrecognised stored origins as unknown, and a review confirmation as its mission', async () => {
    expect((await confirmIncident()).status).toBe(200)
    expect((await receiveRelay()).status).toBe(200)
    const relayed = db.mission_events[1]
    db.mission_events.push({ ...relayed, id: '00000000-0000-4000-9000-00000000ffff', idempotency_key: 'lesson:unrecognised',
      created_at: stamp(), detail: JSON.stringify({ ...JSON.parse(relayed.detail as string), origin: 'something-new' }) })
    storeReviewConfirmation(ORIGIN)
    const lessons = await loadConfirmedLessons(client(), 'owner', [])
    expect(lessons).toHaveLength(4)
    expect(lessons.map(lesson => JSON.parse(db.mission_events.find(row => row.id === lesson.id)!.detail as string).origin ?? 'review'))
      .toEqual(['review', 'something-new', 'relay', 'incident'])
    expect(lessons.map(lesson => lesson.originMissionId)).toEqual([ORIGIN, null, null, null])
    expect(lessons.slice(1).every(lesson => lesson.missionId === ANCHOR)).toBe(true)
    expect(lessons[3]).toMatchObject({ rule: incident.proposedRule, exceptions: incident.exceptions, mechanism: incident.mechanism })
  })

  it('does not prioritise or label a casebook anchor, and keeps the four vocabulary-related projects', async () => {
    await confirmCasebook()
    const context = await loadProjectContext(client(), 'owner', TARGET)
    const status = (missionId: string) => context.sources.find(source => source.id === `mission:${missionId}`)?.status ?? ''
    expect(context.sources.filter(source => source.status.includes('Confirmed lesson origin'))).toEqual([])
    expect(status(ANCHOR)).toContain('Other project summary only')
    for (const related of VOCABULARY) expect(status(related)).toContain('Shared context terms')

    const lesson = context.sources.find(source => source.kind === 'lesson')!
    for (const kept of [casebook.proposedRule, casebook.whenToApply, casebook.exceptions, casebook.record.sharedStructure]) {
      expect(Object.values(JSON.parse(lesson.text))).toContain(kept)
    }
    expect(JSON.parse(lesson.text)).toMatchObject({ scope: 'account', originMissionId: null, sourceRefs: reviewCandidateSources(casebook) })
    // The anchor is not offered to the model as provenance anywhere on the source.
    expect(lesson.missionId).toBeUndefined()
    expect(JSON.stringify(lesson)).not.toContain(ANCHOR)
    expect(lesson.status).toContain('Origin project unknown')
    expect(context.warnings.join(' ')).not.toMatch(/confirmed lesson origins/)
  })

  it('still prioritises and labels a review-origin lesson project and a prior correction project', async () => {
    await confirmCasebook()
    storeReviewConfirmation(ORIGIN)
    db.mission_events.push({ id: '00000000-0000-4000-9000-00000000cccc', created_at: stamp(), user_id: 'owner', mission_id: CORRECTED,
      type: 'delta_corrected', detail: JSON.stringify({ reason: 'PLACEHOLDER correction (simulation only).' }), idempotency_key: 'placeholder-correction' })
    const context = await loadProjectContext(client(), 'owner', TARGET)
    const status = (missionId: string) => context.sources.find(source => source.id === `mission:${missionId}`)?.status ?? ''
    expect(status(ORIGIN)).toBe('Confirmed lesson origin; structural relevance must be investigated.')
    expect(status(CORRECTED)).toBe('Prior correction origin; structural relevance must be investigated.')
    expect(status(ANCHOR)).toContain('Other project summary only')
    expect(context.sources.find(source => source.id.startsWith('lesson:') && source.missionId === ORIGIN)?.lesson)
      .toMatchObject({ scope: 'account', originMissionId: ORIGIN })
  })

  it('selects known origins first without displacing vocabulary matches for anything else', () => {
    const candidates = [ANCHOR, ORIGIN, CORRECTED, ...VOCABULARY].map((missionId, index) => ({
      mission: { id: missionId, updated_at: `2026-11-0${index + 1}T00:00:00Z` }, score: VOCABULARY.includes(missionId) ? 2 : 0, reason: 'signal' }))
    expect(selectInvestigationProjects(candidates, [], []).map(item => item.mission.id).sort()).toEqual([...VOCABULARY].sort())
    const selected = selectInvestigationProjects(candidates, [ORIGIN], [CORRECTED])
    expect(selected.slice(0, 2).map(item => [item.mission.id, item.reason.split(';')[0]]))
      .toEqual([[ORIGIN, 'Confirmed lesson origin'], [CORRECTED, 'Prior correction origin']])
    expect(selected).toHaveLength(4)
  })

  it('rejects a bridge that cites an unknown-origin lesson against its anchor, and never measures it as applied', async () => {
    await confirmCasebook()
    storeReviewConfirmation(ORIGIN)
    const context = await loadProjectContext(client(), 'owner', TARGET)
    const lessonSource = (originKnown: boolean) => context.sources.find(source => source.kind === 'lesson' &&
      (typeof source.lesson?.originMissionId === 'string' || source.missionId === ORIGIN) === originKnown)!.id
    const bridge = (prior: string, quote: string, lessonSourceId: string | null) => ({
      priorSourceId: `mission:${prior}`, currentSourceId: `mission:${TARGET}`, priorQuote: quote, currentQuote: 'Darkroom print portfolio',
      sharedStructure: 'placeholder', reasoningBridge: 'placeholder', application: 'placeholder', proofRequired: 'placeholder', lessonSourceId })
    expect(parseStructuralBridge(bridge(ANCHOR, 'Tax paperwork', lessonSource(false)), context.sources, TARGET)).toBeNull()
    // The same two projects may still be bridged without claiming the lesson came from one of them.
    expect(parseStructuralBridge(bridge(ANCHOR, 'Tax paperwork', null), context.sources, TARGET)).not.toBeNull()
    expect(parseStructuralBridge(bridge(ORIGIN, 'Garden irrigation', lessonSource(true)), context.sources, TARGET))
      .toMatchObject({ lessonSourceId: lessonSource(true) })

    const proposal = (lessonSourceId: string) => ({ decision: 'act', operation: 'placeholder', finishWhen: 'placeholder', clarification: null,
      resumeActionId: null, workDraft: null, structuralBridge: bridge(ANCHOR, 'Tax paperwork', lessonSourceId) }) as unknown as ReviewProposal
    const measure = (lessonSourceId: string) => measureTransfer({ baseline: proposal(lessonSourceId), after: proposal(lessonSourceId),
      sources: context.sources, lessons: context.lessons, missionId: TARGET, requestContextAdded: false,
      reviewedAt: new Date().toISOString(), interventionEvidence: context.interventionEvidence })
    expect(measure(lessonSource(false))).toMatchObject({ appliedLessonSourceId: null, outcome: 'no_grounded_cross_project_application' })
    expect(measure(lessonSource(true)).appliedLessonSourceId).toBe(lessonSource(true))
  })

  it('does not hand Brief, analyze or task routing the anchor as where an account rule was learned', async () => {
    await confirmCasebook()
    const account = formatLearnedContext(await loadConfirmedLessons(client(), 'owner', []), [])
    expect(account).toContain(JSON.stringify(casebook.proposedRule).slice(1, -1))
    expect(account).toContain(JSON.stringify(casebook.exceptions).slice(1, -1))
    expect(account).not.toContain(ANCHOR)
    expect(account).toContain('"originMissionId":null')
    expect(account).toMatch(/ledger/i)

    db.mission_events = []
    await confirmCasebook('mission')
    const scoped = formatLearnedContext(await loadConfirmedLessons(client(), 'owner', [ANCHOR]), [ANCHOR])
    // A mission-scoped rule still names the one project it applies to, as scope, not as origin.
    expect(scoped).toContain(`"appliesOnlyToMissionId":"${ANCHOR}"`)
    expect(scoped).toContain('"originMissionId":null')
  })
})
