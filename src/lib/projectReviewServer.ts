import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { boundSourceText, githubFileReference, sourceLinks, type ProjectSource } from './projectReview'

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
async function readPublicFile(url: string): Promise<ProjectSource> {
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
  return { id: `repository:${file.owner}/${file.repository}/${file.path}@${data.sha}`, label: `${file.repository}/${file.path}`, kind: 'repository', status: 'fetched source; claims within it are not independently verified', url, ...boundSourceText(text) }
}

export async function loadProjectContext(client: ReturnType<typeof projectUserClient>, userId: string, missionId: string) {
  const target = await client.from('missions').select('id,title,why,finish_line,evidence_requirement,state,blocker,capacity_mismatch,updated_at').eq('id', missionId).eq('user_id', userId).single()
  if (target.error || !target.data) throw new Error('The mission is unavailable in this account.')
  const results = await Promise.all([
    client.from('missions').select('id,title,why,finish_line,state,blocker,updated_at').eq('user_id', userId).neq('id', missionId).order('updated_at', { ascending: false }).limit(8),
    client.from('evidence_snapshots').select('id,source,status,claim,observed_at,fetched_at').eq('mission_id', missionId).order('fetched_at', { ascending: false }).limit(12),
    client.from('actions').select('id,action_title,status,resume_note,updated_at').eq('mission_id', missionId).order('updated_at', { ascending: false }).limit(8),
    client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', missionId).in('type', ['delta_context_added', 'delta_step_supplied', 'finish_line_set']).order('created_at', { ascending: false }).limit(24),
    client.from('mission_events').select('id,type,detail,created_at').eq('user_id', userId).eq('mission_id', missionId).eq('type', 'delta_corrected').order('created_at', { ascending: false }).limit(100),
    // Safety state must cover every linked row, even when source excerpts
    // are bounded. In particular, a Secondary cannot inherit the Primary's gate.
    client.from('evidence_snapshots').select('id', { count: 'exact', head: true }).eq('mission_id', missionId).eq('status', 'conflict'),
  ])
  // An unavailable read is not an empty set. Do not call the model on a
  // deceptively complete context packet.
  if (results.some(r => r.error)) throw new Error('Could not read all project context. Your saved work is unchanged.')
  const [missions, evidence, actions, events, corrections, conflicts] = results
  const hasEvidenceConflict = (conflicts.count ?? 0) > 0
  const sources: ProjectSource[] = [{ id: `mission:${target.data.id}`, label: target.data.title, kind: 'mission', status: 'human-defined outcome', ...boundSourceText(JSON.stringify(target.data), 4_000) }]
  for (const row of missions.data ?? []) sources.push({ id: `mission:${row.id}`, label: row.title, kind: 'mission', status: 'other human-defined project; relevance is proposed', ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of evidence.data ?? []) sources.push({ id: `evidence:${row.id}`, label: row.source, kind: 'evidence', status: row.status, ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of actions.data ?? []) sources.push({ id: `action:${row.id}`, label: row.action_title, kind: 'commitment', status: 'human-reported commitment and progress; not verified completion', ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of events.data ?? []) sources.push({ id: `event:${row.id}`, label: row.type === 'delta_corrected' ? 'Your correction' : 'Your project context', kind: row.type === 'delta_corrected' ? 'correction' : 'human_note', status: 'human-reported', ...boundSourceText(JSON.stringify(row), 2_000) })
  for (const row of corrections.data ?? []) sources.push({ id: `event:${row.id}`, label: 'Your correction', kind: 'correction', status: 'human correction; authoritative for this recommendation', ...boundSourceText(JSON.stringify(row), 2_000) })
  const warnings = ['Context is bounded to 8 other projects, 12 evidence rows, 8 commitments, 24 recent context events and 100 corrections. Older or omitted material may change the interpretation.']
  const notes = (events.data ?? []).filter(e => e.type === 'delta_context_added').map(e => e.detail).join('\n')
  for (const link of sourceLinks(notes)) {
    try { sources.push(await readPublicFile(link)) }
    catch { warnings.push(`Could not inspect ${link}. Do not claim to know its contents.`) }
  }
  // Preserve corrections and human context before less relevant projects
  // when the total packet must be clipped.
  const priority: Record<ProjectSource['kind'], number> = { correction: 1, human_note: 2, repository: 3, evidence: 4, commitment: 5, mission: 6 }
  sources.sort((a, b) => a.id === `mission:${missionId}` ? -1 : b.id === `mission:${missionId}` ? 1 : priority[a.kind] - priority[b.kind])
  let remaining = 40_000
  const bounded = sources.map(source => {
    const cut = boundSourceText(source.text, Math.max(0, remaining))
    remaining -= cut.text.length
    return { ...source, ...cut, truncated: Boolean(source.truncated || cut.truncated) }
  }).filter(source => source.text.length)
  if (bounded.length !== sources.length) warnings.push(`${sources.length - bounded.length} sources were omitted by the total context limit.`)
  const contextKey = createHash('sha256').update(JSON.stringify({ version: 2, target: target.data, sources: bounded, warnings, hasEvidenceConflict })).digest('hex')
  return { mission: target.data, sources: bounded, warnings, contextKey, hasEvidenceConflict }
}
