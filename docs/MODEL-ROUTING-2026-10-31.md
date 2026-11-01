# Legacy Codex model routing — 2026-10-31

## Purpose

The model must be appropriate to the cognitive operation, not merely available.
A fallback must retain the requested depth; it does not validate or save an
AI answer. The primary owner/account auth gate, RLS and source truth are unchanged.

## Live code targets (API catalog verified October 31, 2026)

| Task tier | Anthropic | Google | OpenAI |
| --- | --- | --- | --- |
| Routine: Daily Brief, Triage, bounded operation suggestions | `claude-sonnet-5-5` | `gemini-3.8-flash` | `gpt-6.1-terra` |
| Deep: Ask, Architect Scan, Break Wall, Project Review | `claude-opus-5-5` | `gemini-4-argon` | `gpt-6.1-sol` |

File analysis remains Claude-only (Opus 5.5); this does not imply
that an attached file is retained or that a proposed lesson was stored.

The chain checks only existing server-side `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, and `OPENAI_API_KEY` presence; it does not change secrets,
billing, owner allowlists or Supabase. Each tier and provider can be overridden
with `CODEX_<TIER>_<PROVIDER>_MODEL` (for example,
`CODEX_DEEP_OPENAI_MODEL`). Legacy `GEMINI_MODEL` and `OPENAI_MODEL`
are intentionally ignored by this chain, so old configuration cannot silently
force GPT-4o or Gemini 2.5 Pro back into a frontier request.

## Reasoning / cost controls

- Anthropic uses Messages API. Opus 5.5 uses adaptive thinking. Forced tool
  choice is not supported with thinking, so Project Review allows tool use
  and validates its returned structure; missing tool output triggers fallback.
- Gemini 3+ uses `thinkingConfig.thinkingLevel` (routine: low; deep: medium).
  Argon requires sufficient allowance for internal reasoning: the synchronous
  generation cap is 32,768 output/thinking tokens. This is an upper bound,
  not intended usage. An incomplete/empty result is a failure, not a success.
- OpenAI uses `/v1/responses` with `reasoning.effort` and
  `max_output_tokens`; `store: false`. Project Review tool calls use
  Responses API function calls. An incomplete output cannot pass as a result.
- Brief timeout is 95 seconds with no SDK retries, bounded attempts and
  route maxDuration 120 seconds. Project Review has its own existing deadline.
- No per-request dollar estimate, global spending cap, or billing guard was
  added. Token ceilings limit exposure, **not total monthly API charges**.
  Provider quotas/rate limits and project billing remain separate. Do not
  claim the app now enforces a dollar budget.

## Verification and release boundary

Repository tests and build verify code contracts, not model availability.
The Vercel deployment and a real owner-authorized request must be observed
separately. The owner must verify provider/model on a real question after
deployment; no artificial mission rows or fake transfer evidence may be
created. A model answer remains `Unverified, nothing was saved` until a
separate confirmed write/proven outcome exists.

## API documentation checked

- Anthropic current models: https://platform.claude.com/docs/en/models/overview
- Anthropic Opus 5.5: https://platform.claude.com/docs/en/models/opus-5-5/overview
- Google model IDs: https://ai.google.dev/gemini-api/docs/models
- Google thinking: https://ai.google.dev/gemini-api/docs/generate-content/thinking
- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI reasoning & Responses API: https://developers.openai.com/api/docs/guides/reasoning
