# Development Setup Guide

## Overview
- Frontend: a static Vite-powered PWA in the repo root (`src/`, `index.html`,
  `service-worker.js`, `manifest.json`).
- Backend: a FastAPI service in `artful-backend/`.
- Supabase migrations live in `supabase/migrations/`.

## Frontend setup
- `npm install`: Install dependencies.
- `npx vite`: Run the development server.
- `npm run build`: Build for production.

## Backend setup
```bash
cd artful-backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Backend environment variables
Set these in `artful-backend/.env`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing and linting
- No automated test suite is configured.
- No lint/format scripts are configured.
- Use `npm run build` as the primary frontend sanity check.

## Notes
- `dist/` contains built assets. Update it only when you intentionally rebuild
  the frontend.
