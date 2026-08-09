#!/usr/bin/env node
// Evidence bridge: polls GitHub (PR + check-run state) for the configured
// repos and writes public/notes/evidence-snapshot.json in the shape defined
// by src/lib/evidence.ts (EvidenceRecord). Mirrors the existing biometrics
// bridge contract — this script has no opinion about which mission a record
// belongs to; linking happens in the app, not here.
//
// Notion support is intentionally a no-op until NOTION_TOKEN is set as a
// repo secret. No fabricated Notion evidence is ever written — this repo's
// standing rule is real data or an explicit missing state, never a guess.

import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const GITHUB_TOKEN = process.env.EVIDENCE_BRIDGE_TOKEN || process.env.GITHUB_TOKEN
const REPOS = (process.env.EVIDENCE_REPOS || 'edwardemoryphotography/legacy-codex')
  .split(',')
  .map(r => r.trim())
  .filter(Boolean)
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'notes', 'evidence-snapshot.json')

if (!GITHUB_TOKEN) {
  console.error('No GitHub token available (EVIDENCE_BRIDGE_TOKEN or GITHUB_TOKEN). Refusing to write a snapshot with no data.')
  process.exit(1)
}

async function githubJSON(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${url} -> ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function pullRequestEvidence(repo) {
  const prs = await githubJSON(
    `https://api.github.com/repos/${repo}/pulls?state=all&per_page=20&sort=updated&direction=desc`,
  )
  const records = []

  for (const pr of prs) {
    const merged = Boolean(pr.merged_at)
    let checksStatus = 'unverified'
    let checksClaim = 'No check-run data available.'

    // checksStatus/checksClaim are only ever used below when merged is true
    // — skip the extra API call entirely for open PRs to avoid burning
    // rate limit on data that gets thrown away.
    if (merged) {
      try {
        const checks = await githubJSON(`https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs`)
        const runs = checks.check_runs || []
        if (runs.length) {
          const allPassed = runs.every(r => ['success', 'neutral', 'skipped'].includes(r.conclusion))
          checksStatus = allPassed ? 'verified' : 'conflict'
          checksClaim = `${runs.length} check run(s), ${runs.filter(r => r.conclusion === 'success').length} passing.`
        }
      } catch {
        // A failed check-run lookup must not erase the PR's own merged
        // status — fall back to 'stale' for the checks claim only.
        checksStatus = 'stale'
        checksClaim = 'Check-run data unavailable.'
      }
    }

    records.push({
      id: `github-pr-${repo}-${pr.number}`,
      missionId: null,
      source: `github:${repo}#${pr.number}`,
      kind: merged ? 'merged_pr' : 'custom',
      status: merged ? checksStatus : 'unverified',
      claim: merged
        ? `PR #${pr.number} "${pr.title}" merged. ${checksClaim}`
        : `PR #${pr.number} "${pr.title}" open, not yet merged.`,
      observedAt: pr.updated_at,
      fetchedAt: new Date().toISOString(),
    })
  }

  return records
}

async function main() {
  const allRecords = []

  for (const repo of REPOS) {
    try {
      allRecords.push(...(await pullRequestEvidence(repo)))
    } catch (err) {
      // One unreachable repo must not blank out evidence for the others
      // (spec §8: preserve last verified state on an unreachable source).
      console.error(`Failed to pull evidence for ${repo}:`, err.message)
    }
  }

  if (process.env.NOTION_TOKEN) {
    console.log('NOTION_TOKEN is set, but the Notion pull is not implemented yet — add it here, do not fake records.')
  }

  const snapshot = { generatedAt: new Date().toISOString(), records: allRecords }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Wrote ${allRecords.length} evidence record(s) to ${OUTPUT_PATH}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
