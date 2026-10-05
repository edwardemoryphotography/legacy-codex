// Preserve real observations across partial source outages. Never refresh the
// timestamps of a record that could not be read during this poll.
function validRecord(r) {
  return r && typeof r === 'object' && typeof r.id === 'string' &&
    (r.missionId === null || typeof r.missionId === 'string') &&
    typeof r.source === 'string' && r.source.trim() &&
    ['merged_pr', 'live_deployment', 'published_artifact', 'confirmed_action', 'custom'].includes(r.kind) &&
    ['verified', 'unverified', 'conflict', 'stale'].includes(r.status) &&
    typeof r.claim === 'string' && typeof r.observedAt === 'string' &&
    Number.isFinite(Date.parse(r.observedAt)) && typeof r.fetchedAt === 'string' && Number.isFinite(Date.parse(r.fetchedAt))
}
export function mergeEvidenceSnapshot(previous, observations, repos, failedRepos, failedRecordIds = []) {
  if (!previous || !Number.isFinite(Date.parse(previous.generatedAt)) ||
      !Array.isArray(previous.records) || !previous.records.every(validRecord) ||
      !Array.isArray(observations) || !observations.every(validRecord)) {
    throw new Error('Invalid evidence snapshot; refusing to replace existing observations.')
  }
  const failedIds = new Set(failedRecordIds)
  const previousIds = new Set(previous.records.map(row => row.id))
  const fresh = observations.filter(row => !failedIds.has(row.id) || !previousIds.has(row.id))
  const failed = new Set(failedRepos)
  const successful = repos.filter(repo => !failed.has(repo))
  const retained = previous.records.filter(row => failedIds.has(row.id) || !successful.some(repo => row.source.startsWith(`github:${repo}#`)))
    .map(row => failedIds.has(row.id) || failedRepos.some(repo => row.source.startsWith(`github:${repo}#`)) ? { ...row, status: 'stale' } : row)
  const freshIds = new Set(fresh.map(row => row.id))
  return { generatedAt: new Date().toISOString(), unavailableSources: [...failedRepos.map(repo => `github:${repo}`), ...failedRecordIds.map(id => `check-runs:${id}`)],
    records: [...fresh, ...retained.filter(row => !freshIds.has(row.id))] }
}
