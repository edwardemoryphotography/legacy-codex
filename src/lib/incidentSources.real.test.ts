/** @vitest-environment node */
// REAL-SOURCE CHECK. Reads the public GitHub record for every source an
// incident candidate cites and compares it with what the candidate says.
// It needs the network, so it only runs on request: `npm run verify:incidents`.
// It checks that the cited PRs exist, are merged, and carry the stated times
// and the quoted facts. It cannot check the owner's iPhone, and it says
// nothing about whether any lesson was later applied.
import { describe, expect, it } from 'vitest'
import { INCIDENT_CANDIDATES } from './incidentCandidates'

const run = process.env.VERIFY_REAL_SOURCES === '1'
const api = (url: string) => url.replace('https://github.com/', 'https://api.github.com/repos/').replace('/pull/', '/pulls/')

describe.runIf(run)('incident candidates against their public sources', () => {
  for (const candidate of INCIDENT_CANDIDATES) {
    it(`${candidate.id}: every cited PR is merged at the stated time, in order`, async () => {
      const pulls = await Promise.all(candidate.attempts.map(async attempt => {
        const source = candidate.sources.find(item => item.id === attempt.sourceId)!
        const response = await fetch(api(source.url), { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'incident-source-check' } })
        expect(response.status, source.url).toBe(200)
        return { attempt, pull: await response.json() as { merged: boolean; merged_at: string; body: string | null } }
      }))
      for (const { attempt, pull } of pulls) {
        expect(pull.merged, attempt.sourceId).toBe(true)
        expect(pull.merged_at, attempt.sourceId).toBe(attempt.observedAt)
      }
      const times = pulls.map(({ pull }) => Date.parse(pull.merged_at))
      expect([...times].sort((a, b) => a - b)).toEqual(times)
      console.log(pulls.map(({ attempt, pull }) => `${candidate.id} ${attempt.sourceId} merged ${pull.merged_at}`).join('\n'))
    }, 30_000)
  }

  it('IC-001: the PR texts say what the candidate attributes to them', async () => {
    const body = async (n: number) => ((await (await fetch(`https://api.github.com/repos/edwardemoryphotography/legacy-codex/pulls/${n}`,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'incident-source-check' } })).json()) as { body: string | null }).body ?? ''
    const [first, second, third] = await Promise.all([body(185), body(186), body(187)])
    expect(first).toMatch(/visualViewport/i)
    expect(second).toMatch(/embedded|in-app|ChatGPT/i)
    expect(third).toMatch(/<dialog>|dialog/i)
    expect(third).toMatch(/top layer/i)
  }, 30_000)
})
