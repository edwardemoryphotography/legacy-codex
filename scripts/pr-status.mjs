#!/usr/bin/env node
// PR status: one plain-text answer to "what is actually merged, what is open,
// and which AI owns it?" Reads real GitHub state only — no cached or invented
// data. Read-only; it never writes to GitHub.
//
// Auth: uses the GitHub CLI (`gh auth login`) when installed, otherwise a
// GITHUB_TOKEN / GH_TOKEN with read access to the repo.
//
// Usage: node scripts/pr-status.mjs [owner/repo] [--all]
//   default repo: edwardemoryphotography/legacy-codex
//   --all also lists merged and closed PRs (default shows open + a merged tally)
//
// Why `merged_at` and not `state`: GitHub reports a squash-merged PR as
// state "closed". Only a non-null `merged_at` means the work reached main.

import { execFileSync } from 'node:child_process'

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.EVIDENCE_BRIDGE_TOKEN
const args = process.argv.slice(2)
const showAll = args.includes('--all')
const repo = args.find(a => a.includes('/')) || 'edwardemoryphotography/legacy-codex'
const STALE_DAYS = 14

function hasGh() {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const USE_GH = hasGh()

if (!USE_GH && !TOKEN) {
  console.error('Neither the gh CLI nor a GitHub token (GITHUB_TOKEN / GH_TOKEN) is available. Refusing to guess PR state.')
  process.exit(1)
}

async function getPage(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${url} -> ${res.status} ${res.statusText}`)
  return res.json()
}

async function getAll(path) {
  if (USE_GH) {
    const sep = path.includes('?') ? '&' : '?'
    const raw = execFileSync('gh', ['api', '--paginate', '--slurp', `${path}${sep}per_page=100`], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    return JSON.parse(raw).flat()
  }
  const out = []
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const batch = await getPage(`https://api.github.com${path}${sep}per_page=100&page=${page}`)
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out
}

// Which AI/tool owns a PR: the branch prefix (claude/, codex/, cursor/ ...),
// or the bot account when the branch has no prefix.
function agentOf(pr) {
  const prefix = pr.head.ref.includes('/') ? pr.head.ref.split('/')[0] : null
  if (prefix) return prefix
  return pr.user.login.endsWith('[bot]') ? pr.user.login.replace('[bot]', '') : 'human/other'
}

const ageDays = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
const day = iso => iso.slice(0, 10)

const [prs, branches] = await Promise.all([
  getAll(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc`),
  getAll(`/repos/${repo}/branches`),
])

const open = prs.filter(p => p.state === 'open')
const merged = prs.filter(p => p.merged_at)
const closedUnmerged = prs.filter(p => p.state === 'closed' && !p.merged_at)
const mergedBranches = new Set(merged.map(p => p.head.ref))
const openBranches = new Set(open.map(p => p.head.ref))

console.log(`${repo} — PR status as of ${new Date().toISOString().slice(0, 16)}Z`)
console.log(`Open ${open.length} · Merged ${merged.length} · Closed without merging ${closedUnmerged.length} · Branches ${branches.length}\n`)

console.log('OPEN PRs, by agent')
const byAgent = Map.groupBy(open, agentOf)
for (const [agent, list] of [...byAgent].sort()) {
  console.log(`  ${agent}`)
  for (const p of list) {
    const flags = []
    if (p.draft) flags.push('draft')
    if (mergedBranches.has(p.head.ref)) flags.push('BRANCH ALREADY SQUASH-MERGED ELSEWHERE — likely stale')
    const age = ageDays(p.updated_at)
    if (age >= STALE_DAYS) flags.push(`no activity ${age}d`)
    console.log(`    #${p.number} ${p.title}${flags.length ? `  [${flags.join('; ')}]` : ''}`)
    console.log(`        ${p.head.ref} · updated ${day(p.updated_at)}`)
  }
}

const orphan = branches
  .map(b => b.name)
  .filter(n => n !== 'main' && !openBranches.has(n) && mergedBranches.has(n))
console.log(`\nBRANCHES that had a PR squash-merged, no open PR now (${orphan.length}) — don't build on these; check for newer unmerged commits before deleting:`)
for (const n of orphan) console.log(`    ${n}`)

const noPr = branches.map(b => b.name).filter(n => n !== 'main' && !prs.some(p => p.head.ref === n))
console.log(`\nBRANCHES with no PR ever (${noPr.length}) — unknown intent, ask which AI made it:`)
for (const n of noPr) console.log(`    ${n}`)

if (showAll) {
  console.log('\nMERGED')
  for (const p of merged) console.log(`    #${p.number} ${day(p.merged_at)} ${p.title}  (${p.head.ref})`)
  console.log('\nCLOSED WITHOUT MERGING (work is NOT on main)')
  for (const p of closedUnmerged) console.log(`    #${p.number} ${day(p.closed_at)} ${p.title}  (${p.head.ref})`)
}
