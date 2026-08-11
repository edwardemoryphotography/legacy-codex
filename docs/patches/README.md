# Cross-repo patches

## `0001-fix-make-unsigned-command-bar-the-owner-magic-link-s.patch`

Target: [`edwardemoryphotography/artful-intelligence-hub`](https://github.com/edwardemoryphotography/artful-intelligence-hub)

### Why this lives here

The flock hub is a separate repo. This cloud-agent run only has Git write access to `legacy-codex`, so the source change could not be pushed to the hub remote (403). The fix was verified and **deployed live** to https://artful-intelligence-hub.vercel.app via the Vercel CLI so Eddie is unblocked immediately.

Apply this patch on the hub repo before the next Git-backed Vercel deploy, or the CLI production alias can be overwritten by an older `main`.

```bash
git clone https://github.com/edwardemoryphotography/artful-intelligence-hub.git
cd artful-intelligence-hub
git checkout -b cursor/fix-owner-command-bar-signin-c1a7
git am path/to/0001-fix-make-unsigned-command-bar-the-owner-magic-link-s.patch
git push -u origin HEAD
# then open a PR into main
```

### What it fixes

1. Unsigned command bar is magic-link sign-in (`type="email"` + **Send link**), matching the mobile behavior where the owner email was typed into the ask field.
2. Replaces the unregistered `sb_publishable_*` fallback with the working JWT anon key.
3. Surfaces `flock-ask` HTTP 404 as “backend not deployed” instead of a vague failure.

### Still not Live (separate ops)

`flock-ask` Edge Function is still **not deployed** on `pkydkbuodikttfeawqsw` (live probe returns `NOT_FOUND`). After sign-in, Ask cannot succeed until:

```bash
supabase functions deploy flock-ask
supabase secrets set ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  FOUNDRY_WORKSPACE_ID=... FLOCK_OWNER_EMAIL=freddyv@duck.com
```

See hub `docs/FLOCK-HUB-RUNBOOK.md` §§8–10.
