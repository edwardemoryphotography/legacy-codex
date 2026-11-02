# Conversation and Mission continuity — 2026-11-02

Source: Eddie's 3:50 screen recording supplied in this chat, inspected locally. No recording or account identifiers are committed.

Observed acceptance targets:
- Around 0:45–1:35, a follow-up question coexists with History while the answer disclaims conversational memory. Carry bounded recent turns into subsequent questions.
- Full answers show raw Markdown. Render formatting and provide a clear return to the composer.
- Around 1:40–3:30, the long Mission workspace scatters conversation, project context, saves and lifecycle controls. Share the same dialogue and draft between Home and Mission; identify the current project and make starting a new project secondary.
- Around 3:43–3:50, app switching leaves a starfield without controls. This patch does not establish its cause or claim an iPhone resume fix.

Implementation retains one shell-owned orb, existing project records, owner model gating, provider routing, explicit Mission saves and lesson confirmation. The unfinished Converse implementation in the canonical checkout was inspected and left intact; this slice extends the existing Home/Brief path rather than adding another endpoint.

Recent exchanges persist in sessionStorage under the authenticated account ID for this browser tab, with in-memory fallback if storage fails. They are not cross-device history, canonical project records, committed actions or confirmed lessons. At most six exchanges, each side bounded to 4,000 characters, are sent to the model. Project context is reread server-side under the caller's JWT/RLS. Prior assistant statements remain unverified.

Local QA uses isolated request fixtures; nothing is written to production. Mobile and desktop checks exercise Home → Mission with a draft → conversation details → follow-up request → reload, one canvas, readable Markdown, no horizontal overflow, no page errors. Automated tests cover owner denial, malformed history, scoped project reconstruction and per-account restoration. These checks do not prove a real owner answer, beneficial lesson transfer, or physical iPhone background recovery.
