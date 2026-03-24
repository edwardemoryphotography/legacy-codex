# Self-Improving Agent Skill

## Purpose

Records structured learnings from Codex task sessions so future runs can
reference past insights.  Designed for the Legacy Codex neurodivergent
workflow — captures pattern-recognition breakthroughs before the hyperfocus
window closes.

## How It Works

1. After a Codex task completes, the agent (or user) invokes
   `scripts/record-learning.sh` with a short summary.
2. The script writes a timestamped JSON entry into
   `skills/self-improving-agent/learnings/`.
3. Learnings stay inside the repo and are committed with normal git flow.

## Invocation

**Manual only.**  This skill has no auto-run hooks, no cron jobs, and no
background processes.  It is activated only when explicitly called.

```bash
# Record a learning
./skills/self-improving-agent/scripts/record-learning.sh "Lesson text here"

# List existing learnings
ls skills/self-improving-agent/learnings/
```

## Scope

- **Workspace-scoped**: only active inside this repository.
- **Write path**: limited to `skills/self-improving-agent/learnings/`.
- **No network access**: the skill never contacts external services.
- **No shell eval**: no use of `eval`, `curl`, `wget`, `base64`, or
  `python -c` anywhere in this skill.

## Security

See `SECURITY_REVIEW.md` in this directory for the audit checklist.
