import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { boundSourceText, githubFileReference, relatedProjectSignal, sourceLinks, type ProjectSource } from './projectReview'
import { selectInvestigationProjects } from './structuralTransfer'
import { loadConfirmedLessons } from './projectLessonsServer'

// Keep the exact title within the proposal bound. Never truncate a commitment
// into different work just to make it eligible for a Resume recommendation.
function resumableTitle(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.trim().length <= 240 ? value.trim() : undefined
}

export function projectUserClient(url: string, authorization: string) {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
  if (!key || !authorization.startsWith('Bearer ')) throw new Error('Project context authentication is unavailable.')
  return createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

// Public GitHub text files only. The destination is built here, never fetched
// from a model or a returned URL. No redirects, credentials, or private tokens.
async function readPublicFile(url: string, missionId: string): Promise<ProjectSource> {
  const file = githubFileReference(url)
  if (!file) throw new Error('Unsupported source link.')
  const endpoint = `https://api.github.com/repos/${file.owner}/${file.repository}/contents/${file.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(file.ref)}`
  const response = await fetch(endpoint, { headers: { Accept: 'application/vnd.github+json' }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8_000) })
  if (!response.ok || !response.body) throw new Error('Public source unavailable.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.length
      if (bytes > 160_000) throw new Error('Public source too large.')
      chunks.push(chunk.value)
    }
  } finally { await reader.cancel() }
  const row: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!row || typeof row !== 'object') throw new Error('Invalid public source.')
  const data = row as Record<string, unknown>
  if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string' || typeof data.sha !== 'string') throw new Error('Invalid public source.')
  const text = Buffer.from(data.content, 'base64').toString('utf8')
  if (text.includes('\u0000')) throw new Error('Source is not text.')
  return { id: `repository:${file.owner}/${file.repository}/${file.path}@${data.sha}`, label: `${file.repository}/${file.path}`, kind: 'repository', missionId, status: 'fetched source; claims within it are not independently verified', url, ...boundSourceText(text) }
}

export async function loadProjectContext(client: ReturnType<typeof projectUserClient>, userId: string, missionId: string) {
  const target = await client.from('missions').select('id,title,why,finish_line,evidence_requirement,state,blocker,capacity_mismatch,updated_at').eq('id', missionId).eq('user_id', userId).single()
  if (target.error || !target.data) throw new Error('The mission is unavailable in this account.')
  const results = await Promise.all([
    client.from('missions').select('id,title,why,finish_line,state,blocker,updated_at').eq('user_id', userId).neq('id', missionId).order('updated_at', { ascending: false }).limit(50),
    client.from('evidence_snapshots').select('id,source,status,claim,observed_at,fetched_at').eq('mission_id', missionId).order('fetched_at', { ascending: false }).limit(12),
    client.from('actions').select('id,action_title,status,resume_note,updated_at').eq('mission_id', missionId).order('updated_at', { ascending: false }).limit(8),
    client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', missionId).in('type', ['delta_context_added', 'delta_draft_context', 'delta_step_supplied', 'finish_line_set']).order('created_at', { ascending: false }).limit(24),
    client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', missionId).eq('type', 'delta_corrected').order('created_at', { ascending: false }).limit(100),
    // Safety state must cover every linked row, even when source excerpts
    // are bounded. In particular, a Secondary cannot inherit the Primary's gate.
    client.from('evidence_snapshots').select('id', { count: 'exact', head: true }).eq('mission_id', missionId).eq('status', 'conflict'),
    client.from('mission_events').select('id,mission_id,created_at').eq('user_id', userId).neq('mission_id', missionId).eq('type', 'delta_corrected').order('created_at', { ascending: false }).limit(100),
  ])
  // An unavailable read is not an empty set. Do not call the model on a
  // deceptively complete context packet.
  if (results.some(r => r.error)) throw new Error('Could not read all project context. Your saved work is unchanged.')
  const [missions, evidence, actions, events, corrections, conflicts, correctionOrigins] = results
  const hasEvidenceConflict = (conflicts.count ?? 0) > 0
  const sources: ProjectSource[] = [{ id: `mission:${target.data.id}`, label: target.data.title, kind: 'mission', missionId, recordedAt: target.data.updated_at, status: 'human-defined outcome', ...boundSourceText(JSON.stringify(target.data), 4_000) }]
  for (const row of evidence.data ?? []) sources.push({ id: `evidence:${row.id}`, label: row.source, kind: 'evidence', missionId, recordedAt: row.observed_at, status: `Derived snapshot: ${row.status}; not canonical evidence truth`, ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of actions.data ?? []) sources.push({ id: `action:${row.id}`, label: row.action_title, kind: 'commitment', missionId, recordedAt: row.updated_at, status: 'human-reported commitment and progress; not verified completion', commitment: { id: row.id, missionId, status: row.status, actionTitle: resumableTitle(row.action_title) }, ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of events.data ?? []) sources.push({ id: `event:${row.id}`, label: row.type === 'delta_draft_context' ? 'Previous working draft' : 'Your project context', kind: row.type === 'delta_draft_context' ? 'model_draft' : 'human_note', missionId, recordedAt: row.created_at, status: row.type === 'delta_draft_context' ? 'Earlier model-generated draft; unverified, supplied only for revision' : 'human-reported', ...boundSourceText(row.detail, 6_000) })
  for (const row of corrections.data ?? []) sources.push({ id: `event:${row.id}`, label: 'Your correction', kind: 'correction', missionId, recordedAt: row.created_at, status: 'human correction; authoritative for this recommendation', ...boundSourceText(JSON.stringify(row), 2_000) })
  const warnings = ['Up to 4 projects are read deeply: confirmed lesson origins, prior correction origins, then shared vocabulary. Provenance candidates can be fetched outside the 50 recent-project window (up to 20). None is a proven structural match. Eight additional summaries remain available; omitted projects and semantic links may be missed.',
    'Target context is bounded to 12 evidence rows, 8 commitments, 24 notes/events and 100 corrections. Each related project contributes up to 6 evidence rows, 4 commitments, 8 notes and 20 corrections. Lesson history is paged until at most 16 active scoped rules are found; retired and unrelated rules do not consume the selection window. Older or omitted material may change the interpretation.',
    'Evidence here is the Mission evidence_snapshots read model. evidence_items owns canonical evidence truth; those workspace records are not read without a verified account/workspace link. A snapshot status or a human DONE report does not verify the outcome.']
  const notes = (events.data ?? []).filter(e => e.type === 'delta_context_added').map(e => e.detail).join('\n')
  const linkedFiles = sourceLinks(notes).map(url => ({ url, missionId }))
  const targetText = `${target.data.title} ${target.data.why} ${target.data.finish_line ?? ''}\n${notes}`
  const lexical = (missions.data ?? []).map(mission => ({ mission, ...relatedProjectSignal(targetText, mission) }))
    .filter(item => item.score >= 2).sort((a, b) => b.score - a.score || b.mission.updated_at.localeCompare(a.mission.updated_at)).slice(0, 4)
  const targetSourceIds = new Set(sources.map(source => source.id))
  const lessons = await loadConfirmedLessons(client, userId, [missionId, ...lexical.map(item => item.mission.id)])
  const lessonOrigins = [...new Set(lessons.filter(lesson => lesson.scope === 'account' && lesson.missionId !== missionId).map(lesson => lesson.missionId))]
  const correctedOrigins = [...new Set((correctionOrigins.data ?? []).map(row => row.mission_id))] as string[]
  const candidates = [...(missions.data ?? [])]
  const missingIds = [...new Set([...lessonOrigins, ...correctedOrigins])].filter(id => !candidates.some(mission => mission.id === id)).slice(0, 20)
  if (missingIds.length) {
    const origins = await client.from('missions').select('id,title,why,finish_line,state,blocker,updated_at').eq('user_id', userId).in('id', missingIds)
    if (origins.error) throw new Error('Could not read prior lesson/correction origins.')
    candidates.push(...(origins.data ?? []))
  }
  const related = selectInvestigationProjects(candidates.map(mission => ({ mission, ...relatedProjectSignal(targetText, mission) })), lessonOrigins, correctedOrigins)
  for (const lesson of lessons) sources.push({ id: `lesson:${lesson.id}`, label: lesson.rule, kind: 'lesson', missionId: lesson.missionId, recordedAt: lesson.confirmedAt, lesson: { scope: lesson.scope, confirmedAt: lesson.confirmedAt },
    status: `Human-confirmed operating rule (${lesson.scope === 'account' ? 'across this account' : `only project ${lesson.missionId}`}); apply only under its stated conditions, not verified evidence`,
    text: JSON.stringify(lesson), truncated: false })
  const packets = await Promise.all(related.map(async ({ mission, reason }) => {
    const rows = await Promise.all([
      client.from('evidence_snapshots').select('id,source,status,claim,observed_at,fetched_at').eq('mission_id', mission.id).order('fetched_at', { ascending: false }).limit(6),
      client.from('actions').select('id,action_title,status,resume_note,updated_at').eq('mission_id', mission.id).order('updated_at', { ascending: false }).limit(4),
      client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', mission.id).in('type', ['delta_context_added', 'delta_step_supplied', 'finish_line_set']).order('created_at', { ascending: false }).limit(8),
      client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', mission.id).eq('type', 'delta_corrected').order('created_at', { ascending: false }).limit(20),
      client.from('evidence_snapshots').select('id', { count: 'exact', head: true }).eq('mission_id', mission.id).eq('status', 'conflict'),
    ])
    if (rows.some(row => row.error)) throw new Error('A related project could not be read.')
    return { mission: { ...mission, hasEvidenceConflict: (rows[4].count ?? 0) > 0 }, reason, evidence: rows[0].data ?? [], actions: rows[1].data ?? [], notes: rows[2].data ?? [], corrections: rows[3].data ?? [] }
  }))
  for (const packet of packets) {
    const { mission } = packet
    sources.push({ id: `mission:${mission.id}`, label: mission.title, kind: 'mission', missionId: mission.id, recordedAt: mission.updated_at, status: packet.reason, ...boundSourceText(JSON.stringify(mission), 2_000) })
    const wrap = (row: object) => JSON.stringify({ missionId: mission.id, project: mission.title, record: row })
    for (const row of packet.evidence) sources.push({ id: `evidence:${row.id}`, label: `${mission.title}: ${row.source}`, kind: 'evidence', missionId: mission.id, recordedAt: row.observed_at, status: `Derived snapshot: ${row.status}; not canonical evidence truth`, ...boundSourceText(wrap(row), 1_500) })
    for (const row of packet.actions) sources.push({ id: `action:${row.id}`, label: `${mission.title}: ${row.action_title}`, kind: 'commitment', missionId: mission.id, recordedAt: row.updated_at, status: 'Related project commitment; human-reported, not verified completion', commitment: { id: row.id, missionId: mission.id, status: row.status, actionTitle: resumableTitle(row.action_title) }, ...boundSourceText(wrap(row), 1_500) })
    for (const row of packet.notes) sources.push({ id: `event:${row.id}`, label: `${mission.title}: project context`, kind: 'human_note', missionId: mission.id, recordedAt: row.created_at, status: 'Human-reported context on a related project', ...boundSourceText(wrap(row), 1_500) })
    for (const row of packet.corrections) sources.push({ id: `event:${row.id}`, label: `${mission.title}: correction`, kind: 'correction', missionId: mission.id, recordedAt: row.created_at, status: 'Human correction scoped to this related project', ...boundSourceText(wrap(row), 1_500) })
    for (const url of sourceLinks(packet.notes.filter(row => row.type === 'delta_context_added').map(row => row.detail).join('\n'))) {
      if (linkedFiles.length < 2 && !linkedFiles.some(link => link.url === url)) linkedFiles.push({ url, missionId: mission.id })
    }
  }
  const relatedIds = new Set(related.map(item => item.mission.id))
  // Keep a discovery window even without lexical overlap. A model may see
  // a connection in these actual outcomes; it must disclose unread details.
  for (const mission of (missions.data ?? []).filter(row => !relatedIds.has(row.id)).slice(0, 8)) {
    sources.push({ id: `mission:${mission.id}`, label: mission.title, kind: 'mission', missionId: mission.id, recordedAt: mission.updated_at,
      status: 'Other project summary only; relationship unknown and underlying notes/evidence not read',
      ...boundSourceText(JSON.stringify(mission), 800) })
  }
  for (const link of linkedFiles) {
    try { sources.push(await readPublicFile(link.url, link.missionId)) }
    catch { warnings.push(`Could not inspect ${link.url}. Do not claim to know its contents.`) }
  }
  // Preserve corrections and human context before less relevant projects
  // when the total packet must be clipped.
  const priority: Record<ProjectSource['kind'], number> = { correction: 1, lesson: 2, human_note: 3, model_draft: 4, repository: 4, evidence: 5, commitment: 6, mission: 7 }
  sources.sort((a, b) => a.id === `mission:${missionId}` ? -1 : b.id === `mission:${missionId}` ? 1 :
    priority[a.kind] - priority[b.kind] || Number(targetSourceIds.has(b.id)) - Number(targetSourceIds.has(a.id)))
  // A long correction/notes history must not crowd out all evidence and
  // commitments. Preserve category headroom as well as the total bound.
  const headroom: Record<ProjectSource['kind'], number> = { correction: 7_000, lesson: 4_000, human_note: 8_000, model_draft: 6_000,
    repository: 6_000, evidence: 5_000, commitment: 4_000, mission: 8_000 }
  let remaining = 40_000
  const bounded = sources.map(source => {
    const allowance = Math.max(0, Math.min(remaining, headroom[source.kind]))
    // A rule is atomic: never detach conditions or provenance by clipping JSON.
    const cut = source.kind === 'lesson'
      ? { text: source.text.length <= allowance ? source.text : '', truncated: false }
      : boundSourceText(source.text, allowance)
    remaining -= cut.text.length
    headroom[source.kind] -= cut.text.length
    return { ...source, label: source.label.slice(0, 160), status: source.status.slice(0, 300), ...cut, truncated: Boolean(source.truncated || cut.truncated) }
  }).filter(source => source.text.length)
  if (bounded.length !== sources.length) warnings.push(`${sources.length - bounded.length} sources were omitted by the total context limit.`)
  if (bounded.some(source => source.truncated)) warnings.push('Some sources are excerpts. Limits reserve room for evidence and commitments alongside lessons, notes and corrections; inspect originals when a cut could change the interpretation.')
  // The measurement must not miss an intervention simply because its text
  // fell outside the prompt budget or the latest 24 events.
  let interventionEvidence: { since: string; eventCount: number; objectiveUpdated: boolean } | null = null
  const suppliedLessons = lessons.filter(lesson => bounded.some(source => source.id === `lesson:${lesson.id}`))
  if (suppliedLessons.length) {
    const earliest = Math.min(...suppliedLessons.map(lesson => Date.parse(lesson.confirmedAt)))
    if (!Number.isFinite(earliest)) throw new Error('Lesson confirmation time is unavailable.')
    const since = new Date(earliest).toISOString()
    const intervened = await client.from('mission_events').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('mission_id', missionId).gte('created_at', since)
      .in('type', ['delta_context_added', 'delta_step_supplied', 'finish_line_set', 'delta_corrected'])
    if (intervened.error || intervened.count === null) throw new Error('Could not determine whether human intervention occurred.')
    interventionEvidence = { since, eventCount: intervened.count,
      objectiveUpdated: !Number.isFinite(Date.parse(target.data.updated_at)) || Date.parse(target.data.updated_at) >= earliest }
  }
  const contextKey = createHash('sha256').update(JSON.stringify({ version: 8, target: target.data, sources: bounded, warnings, hasEvidenceConflict, interventionEvidence })).digest('hex')
  return { mission: target.data, sources: bounded, warnings, contextKey, hasEvidenceConflict, lessons, interventionEvidence }
}
