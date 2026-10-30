# Vendored: AI-Orb

Source: https://github.com/weeeha/AI-Orb at commit `8540d4e34ae5212cc171fc39d0f1e7798a3d63a9` (2026-10-24).
License: MIT, Copyright (c) 2026 Nick Vyhouski. See `LICENSE` in this folder; keep it with these files.

Copied unchanged: `orb.tsx`, `renderer.ts`, `shader.ts`, `palettes.ts`, `types.ts`.
Not copied: `use-orb-audio.ts`. Codex has no verified microphone amplitude path yet, so no level source is passed and the orb never claims to react to sound.

Codex renders it through `src/components/AuroraOrb.tsx` with `finish="aurora"`.
