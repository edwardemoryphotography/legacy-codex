# Production Git reference (fill from Vercel)

Use this so **local work** has a written anchor for **what production actually is**.

## Option A — Dashboard (no API)

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → project **legacy-codex**.
2. **Deployments** → open the latest **Production** deployment (not Preview).
3. Copy **branch** and **commit SHA** (or screenshot the “Source” panel).

## Option B — CLI in this repo

```bash
npm run vercel-bridge
```

When auth works, the script prints **Production deployment + Git meta** for the linked project (see `.vercel/project.json`).

---

## Record (edit after you look)

| Field | Value |
| --- | --- |
| **Recorded date** | YYYY-MM-DD |
| **Production URL** | [legacy-codex.vercel.app](https://legacy-codex.vercel.app) |
| **Git remote** | e.g. `github.com/you/legacy-codex` |
| **Branch** | e.g. `main` |
| **Commit SHA** | full SHA |
| **This folder** | e.g. “Not a clone — local body only” or path to real clone |

## If this folder is not that repo

That is OK for the **local body** model: keep automation here; **ship** from the **clone that matches the SHA above**, or `git init` / add remote when you are ready to unify.
