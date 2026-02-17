# AGENTS.md

## Purpose
This file is a quick operating guide for coding agents working in this
repository.

## Project overview
- Frontend: static PWA in repo root (source in `src/`, build output in `dist/`).
- Backend: FastAPI service in `artful-backend/`.
- Supabase: JS client in `src/lib/supabase.js`; SQL migrations in
  `supabase/migrations/`.

## Frontend workflow
Install dependencies and build from the repository root:
```bash
npm ci
npm run build
```

Optional command:
```bash
npm run generate-icons
```

Notes:
- `dist/` is generated output from Vite. If frontend code or static assets
  change, run `npm run build` and include regenerated `dist/` files when needed.
- Icons in `icons/` are generated from `icon-base.svg` using
  `npm run generate-icons`.
- There is no dedicated frontend test script in `package.json`.

## Backend workflow
Set up and run the API from `artful-backend/`:
```bash
cd artful-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Environment requirements:
- Populate `artful-backend/.env` with valid Supabase credentials.
- Do not commit secrets or populated `.env` files.

## Database and migrations
- Keep schema changes in `supabase/migrations/`.
- Use descriptive migration names and preserve timestamp prefixes.
- Ensure frontend/backend expectations stay aligned with schema updates.

## Validation and CI expectations
- Primary validation: `npm run build`.
- CI (`.github/workflows/ci.yml`) runs:
  - `npm ci`
  - `npm run build`
  - basic HTML and JavaScript syntax checks
- No dedicated repository-wide automated test suite is currently configured.
