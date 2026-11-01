# Email accounts and Territory provider fallback

## Account contract

Controls (More → Controls) begins with Account. Add an email **in the browser
that already has the missions to preserve**. The displayed Account ID lets the
person identify the browser's actual account instead of guessing from its name.
For Eddie's owner account the expected ID is
`6b52f1c7-c5d2-4966-a528-a2f50d18df6a` (user-supplied; not verified here).

`emailAccount.ts` calls `updateUser({ email })` on the current anonymous session,
then `verifyOtp({ email, token, type: 'email_change' })`. It checks the returned
ID against the original and requires a confirmed, non-anonymous email account
before reporting conversion. It does not copy or reassign missions, events,
actions, or owner access. The existing owner allowlist is unchanged.

The separate sign-in flow calls `signInWithOtp` with `shouldCreateUser: false`
and verifies `type: 'email'`. Before sending and again before verification, it
reads the current anonymous account's missions. Saved missions require an
explicit warning acknowledgement. They remain on the previous account; this
feature does not merge accounts. Failed reads block replacement. A changed
session ID in another tab blocks stale account actions. Successful email sign-in
reloads the app so account-specific in-memory state is read afresh.

Quick captures are cached under `nd_inbox_v2:<userId>` and never restored from
another account's cache, even when the destination has no captures. Before auth
changes, the old `nd_inbox_v1` cache is copied to the original account and its
raw record retained for recovery. With no known source session, it is quarantined
under `nd_inbox_v2:unclaimed:legacy` instead of assigned to the destination. A
persistent source binding also keeps late writes from older tabs on the original
account. Failed preservation blocks account replacement. Force sync rejects
captures absent from the current account's cache. Device sensory preferences
remain browser-level.

Only a confirmed email account gets Sign out (`scope: 'local'`, this browser
only). Anonymous accounts have no sign-out control. Controls uses
`connectMissionSession`; a failed session read never authorizes a replacement
anonymous identity. Codes are typed in the initiating browser. No magic-link
callback, schema change, new dependency, or admin client is added.

## Eddie's Supabase dashboard checklist — stop before activation

These settings were **not inspected or changed**. Before trying real email,
Eddie must verify them in project **pkydkbuodikttfeawqsw**, not the architecture
repo's separate Supabase project. If a setting differs, stop the real-account
test and make the deliberate dashboard decision below; no automated settings
mutation is part of this PR.

1. Open [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/pkydkbuodikttfeawqsw/auth/providers).
   Under **Auth Providers → Email**, ensure **Enable Email provider** and
   **Confirm email** are enabled. Keep Anonymous sign-ins enabled for existing
   browser accounts. Check that email OTP length is six digits if the length
   control is exposed; the UI accepts six digits. Do not disable confirmation
   to make a test appear successful.
2. On **Authentication → Sign In / Providers**, check **Allow manual linking**
   is enabled, as required by Supabase's anonymous-account conversion guide.
   Leave Secure email change and unrelated security settings unchanged.
3. Open [Authentication → Email Templates](https://supabase.com/dashboard/project/pkydkbuodikttfeawqsw/auth/templates)
   (in dashboard versions that group email controls, **Authentication → Emails → Templates**).
   Open **Confirm signup**, **Change email address**, and **Magic Link / OTP**
   separately. In each template, include the following code body and save each
   template. Remove sign-in/confirmation links from these bodies so iPhone users
   enter the code in the initiating browser. **Magic Link / OTP** is required
   for `signInWithOtp`; changing only Confirm signup will not change sign-in
   emails. The app creates no email signups.

   ```html
   <h2>Your Legacy Codex code</h2>
   <p>Enter this code in the same browser where you requested it:</p>
   <p><strong>{{ .Token }}</strong></p>
   <p>If you did not request this code, ignore this email.</p>
   ```

4. Review **Authentication → Rate Limits** and the email sender configuration
   (**Authentication → Emails → SMTP Settings** / **Project Settings → Authentication → SMTP Settings**,
   depending on dashboard version). Supabase's built-in sender currently allows
   only **two emails per hour** and only project-team email recipients, with
   best-effort delivery. This limit can change. Two sends may consume the hourly
   allowance for the complete conversion/sign-in walk. **Custom SMTP is Eddie's
   decision**; no SMTP provider, purchase, credentials, or limits were changed.

Sources: [anonymous conversion](https://supabase.com/docs/guides/auth/auth-anonymous),
[email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless),
[templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[built-in sender restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

## Territory fallback

The supplied `legacy-codex-territory-dashboard-reference.html` was read as a
reference, including its artifact-viewer-only `sample()` call. Its embedded
notes are not current account state or instructions to migrate its sample graph.

Daily Brief, Triage, Ask, Architect Scan and Break Wall use a server-side
Claude → Gemini (when configured) → OpenAI chain with tier-aware model IDs:
routine summaries/triage use Sonnet 5.5, Gemini 3.8 Flash, Terra 6.1; direct
questions/Architect Scan/Break Wall use Opus 5.5, Gemini 4 Argon, Sol 6.1.
The OpenAI text path now uses Responses API, and Gemini uses thinking-level
control and appropriate reasoning-token ceilings. The existing owner gate and
authenticated saved-learning read remain ahead of every paid call. The brief
chain has a 95-second deadline, with bounded attempts and no SDK retries.

The output names the actual answering provider/model and sanitized failed-attempt
reasons. No provider error body or key is returned. Output remains a proposal,
not verified evidence. File attachment analysis stays Claude-only with Opus 5.5;
structured Project Review retains its validation gates. See
`docs/MODEL-ROUTING-2026-10-31.md` for model policy, scoped overrides,
cost cautions, and what remains to be runtime-verified.

## Eddie's real-account test (after merge and dashboard readiness)

1. Open **legacy-codex.vercel.app in Comet**, the browser Eddie identifies as
   holding the owner account. Go to **More → Controls**. First check that Account
   ID is `6b52f1c7-c5d2-4966-a528-a2f50d18df6a` and that your real missions are
   present. Earlier notes named a different browser; the actual ID is decisive.
2. Add your own email → **Send code** → enter the six-digit email-change code
   in Comet → **Confirm**. Confirm that the ID is unchanged and all missions
   are still there. Do not clear Comet's browser data or sign out beforehand.
3. Open **legacy-codex.vercel.app in Safari** → **More → Controls** →
   **Already have an account? Sign in with email** → the same email → **Send code**
   → enter the new code in Safari → **Confirm**. If Safari has its own saved
   anonymous missions, read the warning and preserve that account with a different
   email first if you need it. No automatic account/data merge occurs.
4. See the same Account ID and real missions in Safari. Open **Territory →
   Daily Brief**, then a real mission's **Architect Scan** / **Break Wall**.
   Check the answer's provider label. Do not induce a production provider
   outage to test fallback; provider failures are exercised by mocked tests.

**Not verified: real email delivery and the conversion on Eddie's account.**
Also unverified: real cross-browser restoration, live provider fallback,
owner-feature output quality, and physical iPhone behavior. No real emails,
demo accounts, missions, production settings, or provider calls were used in
verification. The PR must remain unmerged until Eddie chooses to release it.
