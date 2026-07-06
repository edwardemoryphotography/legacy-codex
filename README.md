# legacy-codex

One repo, three deployed apps. Each folder is self-contained and deploys as its own Vercel project.

| App | Folder | Vercel project | What it is |
|---|---|---|---|
| **Legacy Codex** | `/` (repo root: `src/`) | `legacy-codex` → legacy-codex-kappa.vercel.app | The main operational dashboard (V27): Overview, Protocols, Sprint Linker, Resumption Log, Biometrics, Constraint Validator, Codex knowledge graph, Controls. Next.js 14, static export, dark-only, real data only. |
| **The Foundry Console** | `foundry-console/` | `foundry-console` → foundry-console-omega.vercel.app | Web console for **Case Study Zero**: sprints, friction log, milestones, manual pages, audit log. Next.js 15 + Supabase (project `foundry-console` / `pkydkbuodikttfeawqsw`), email OTP sign-in. |
| **PocketForge** | `pocketforge/` | `frontend` (web preview) | iOS app + Convex backend that builds small apps from prompts (multi-provider LLM fallback: Claude → GPT → Gemini; Daytona sandboxes for live previews). |

## Commands (root app)

```bash
npm run dev      # Next.js dev server (http://localhost:3000)
npm run build    # Production build (static export → out/)
npm run lint     # ESLint
```

Foundry Console has its own `package.json` — `cd foundry-console` first. PocketForge lives in `pocketforge/` with its own README.

## Operational notes

- **FREEZE SPEC**: the Legacy Codex app code is frozen — no rewrites without the explicit instruction "REWRITE THE APP CODE".
- **Real data only** — no mock/synthetic/simulated content anywhere.
- Foundry Console depends on the Supabase project `foundry-console` (free tier). If it auto-pauses from inactivity, Vercel deployments for the `foundry-console` project fail instantly with `Resource provisioning failed` — restore the Supabase project, then redeploy.
- Session/agent guidance lives in `CLAUDE.md`; current project state in `STATE.md`.
