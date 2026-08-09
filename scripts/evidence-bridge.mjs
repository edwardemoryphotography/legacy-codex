#!/usr/bin/env node
// Evidence bridge: polls GitHub (PR + check-run state) for the configured
// repos and upserts rows into the `evidence_snapshots` Supabase table (see
// supabase/migrations/0001_mission_loop.sql) using the service-role key,
// which bypasses RLS — this script is the table's only writer, matching the
// migration's own "Populated by the scheduled evidence-bridge GitHub Action
// ... using the service-role key" comment. MissionTab reads the table
// directly; there is no intermediate JSON file.
//
// Notion support is intentionally a no-op until NOTION_TOKEN is set as a
// repo secret. No fabricated Notion evidence is ever written — this repo's
// standing rule is real data or an explicit missing state, never a guess.

import { createClient } from '@supabase/supabase-js'

const GITHUB_TOKEN = process.env.EVIDENCE_BRIDGE_TOKEN || process.env.GITHUB_TOKEN
const REPOS = (process.env.EVIDENCE_REPOS || 'edwardemoryphotography/legacy-codex')
  .split(',')
  .map(r => r.trim())
  .filter(Boolean)

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!GITHUB_TOKEN) {
  console.error('No GitHub token available (EVIDENCE_BRIDGE_TOKEN or GITHUB_TOKEN). Refusing to write evidence with no data.')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (service-role key bypasses RLS to write evidence_snapshots).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

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
      // Natural key: one row per PR, upserted in place on every run rather
      // than accumulating a new row each schedule tick.
      source: `github:${repo}#${pr.number}`,
      kind: merged ? 'merged_pr' : 'custom',
      status: merged ? checksStatus : 'unverified',
      claim: merged
        ? `PR #${pr.number} "${pr.title}" merged. ${checksClaim}`
        : `PR #${pr.number} "${pr.title}" open, not yet merged.`,
      observed_at: pr.updated_at,
      fetched_at: new Date().toISOString(),
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

  if (!allRecords.length) {
    console.log('No evidence records pulled this run — leaving evidence_snapshots untouched.')
    return
  }

  const { error } = await supabase
    .from('evidence_snapshots')
    .upsert(allRecords, { onConflict: 'source' })

  if (error) {
    throw error
  }

  console.log(`Upserted ${allRecords.length} evidence record(s) into evidence_snapshots.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
