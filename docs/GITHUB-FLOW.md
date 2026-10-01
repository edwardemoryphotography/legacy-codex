# GITHUB-FLOW — what "merged" means, and how several AIs share one repo

Plain-language reference. It explains GitHub vocabulary and the habits that stop
multiple AI builders from tripping over each other. It grants no authority;
`AGENTS.md` owns that.

## 1. Check real state first

```bash
node scripts/pr-status.mjs          # open PRs grouped by AI, flags stale ones
node scripts/pr-status.mjs --all    # also lists every merged / closed-unmerged PR
```

Read-only. Uses the `gh` CLI if installed (`gh auth login`), otherwise a
`GITHUB_TOKEN`. Ask any AI: **"run `scripts/pr-status.mjs` and tell me whether
my last branch is merged"**, not "do you remember?". No AI remembers another AI's session.

## 2. What the words mean

| You see | It means | Work is on `main`? |
|---|---|---|
| **Draft** | Not ready for review | No |
| **Open** | Waiting on CI / review | No |
| **Merged** | Landed on `main` | **Yes** |
| **Closed** (not merged) | Abandoned | **No** |

**Squash and merge** is one of GitHub's three merge buttons. It collapses every
commit on the PR branch into **one new commit on `main`**.

- GitHub then shows the PR as **Merged**, and the code is on `main`.
- Git itself can no longer tell the branch was merged (the original commits never
  reached `main`). A merged branch can look "unmerged" or "ahead of main". That is
  normal. Do not "fix" it.
- The API reports a squash-merged PR as `state: closed`. The only reliable signal is
  `merged_at` being non-empty. `scripts/pr-status.mjs` already uses this.

Merged is also only the first rung. Per `AGENTS.md`:
**Merged → Deployed → Runtime Verified → Live.** A merge does not mean it is live.

## 3. Rules for sharing the repo between AIs

1. **One branch per AI per task.** Prefix with the tool (`claude/`, `codex/`,
   `cursor/`). Two AIs never push to the same branch.
2. **After a PR merges, that branch is finished.** Never push more to it. Start the
   next task on a new branch from current `main`:
   `git fetch origin main && git checkout -b <agent>/<task> origin/main`
3. **Before starting, check state** (section 1). If your last branch's PR is merged,
   begin from `main`. If it is open, continue it. If it is closed-unmerged, ask Eddie
   whether the work was abandoned on purpose.
4. **Claim and release in `HANDOFF.md`** using its existing CLAIM / RELEASE format
   (see `codex-control-panel/standards/HANDOFF-CONTRACT.md`). That is the shared
   memory between AIs. Chat history is not.
5. **Don't open a new PR for a fix that is already merged.** Search first. Several
   PRs for the same change are how stale PRs pile up (see section 4).

## 4. What this looks like in this repo (observed 2026-10-01)

Real output of `scripts/pr-status.mjs` that day: 7 open PRs, 70 merged, 15 closed
without merging, 65 branches. The patterns it surfaced:

- **PR #87 is open on a branch whose earlier PR (#86) was already squash-merged.**
  A follow-up pushed to a finished branch became a second PR instead of starting
  clean from `main`.
- **PRs #83, #84, #85 all target "deployed interface resolution".** The dead-CSS fix
  they describe landed via #80 on 2026-09-08. They look superseded. [INFERENCE: needs
  a human decision before closing.]
- **41 branches had a PR merged and no open PR.** They are clutter, not work in
  progress. Before deleting any, check for commits pushed after the merge.
- **6 branches have no PR at all.** Their intent is unknown. Ask which AI made them.

Everything else in the open list is ordinary in-flight work.

## 5. Cleanup is a human call

The script only reports. Closing PRs and deleting branches are outward-facing and
hard to undo, so an AI should propose a list and wait for Eddie's go-ahead on that
specific list. A request to build something does not authorize deleting history.
