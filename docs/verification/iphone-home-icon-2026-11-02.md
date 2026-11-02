# iPhone Home Screen icon — November 2, 2026

## Scope and source

Production had no icon declaration, and `/apple-icon.png`, `/apple-touch-icon.png`
and `/favicon.ico` returned 404. This repair adds only static icon assets:

- `src/app/apple-icon.png`: 180 × 180 RGB PNG, fully opaque.
- `src/app/icon.png`: 32 × 32 RGB PNG for browser tabs.

The artwork is a still of the existing `CodexOrb.tsx` shader at source commit
`6aa3cd03a36ed0937f7d126d1818e4399ef174bb`, using the default Aurora palette,
phase 3, time 0 and the idle uniforms (rim 0.35, sweep 0, bright 0.85, ring 0).
It was rendered in an isolated, network-free canvas at 1024 × 1024, composited
onto Codex Glass ink `#0D0F22`, then downsampled with Lanczos3. The square has no
baked-in rounded corners; iOS applies its own mask. The app itself was not opened
to make the artwork, and no account or mission was created.

Next.js 16.3.0's bundled `app-icons.md` documents that these file conventions
automatically emit `rel="apple-touch-icon"` / `rel="icon"`, PNG MIME types,
dimensions and asset URLs. No layout, application logic, auth, dependencies,
manifest, standalone-launch mode or service worker changes are needed.

## Verification contract

Build and serve the production app, then GET `/` without executing application
JavaScript. Check the generated icon links, fetch their exact declared URLs and
verify PNG MIME types, decoded dimensions, opacity and byte equality with the
checked-in assets. Repeat against `https://legacy-codex.vercel.app` after the
intended `frontend` production deployment is Ready. These checks must not load
the app in a fresh executable browser context, since it creates an anonymous
Supabase account. Direct icon viewing is safe.

Deployment identity and release proof are recorded in the PR and release report.
HTTP/image checks establish the served icon, not a physical iPhone installation.

Local verification passed: all 559 tests across 58 files, TypeScript, builder
and immersive checks, production build, and diff whitespace checks. Lint had
zero errors and 13 warnings in unchanged files. The production server emitted
both expected links; both exact declared URLs returned 200 / `image/png` for
ordinary and iPhone User-Agent requests, with the expected RGB dimensions and
byte-for-byte matches to the checked-in assets. The decoded 180px asset was
visually inspected. A User-Agent request is not a physical device test.

## Physical iPhone check

Open the canonical production site in the browser you intend to use, choose
Share → Add to Home Screen, and check that the preview shows the violet/cyan
Codex orb on dark ink. Add it and confirm that same image appears on the Home
Screen. An existing shortcut may retain its cached icon; inspect a new preview
before changing any existing shortcut. Do not clear website data, sign out,
remove the existing Home Screen app, or change accounts to refresh an icon.
No account continuity or mission restoration claim is established by this repair.
