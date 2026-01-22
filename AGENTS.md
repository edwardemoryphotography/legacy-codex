# AGENTS.md

## Project overview
- Static PWA frontend in repo root (Vite build output in `dist/`).
- FastAPI backend in `artful-backend/`.
- Supabase client in `src/lib/supabase.js` and migrations in `supabase/migrations/`.

## Frontend setup and commands
```bash
npm ci
npm run build
```

Optional:
```bash
npm run generate-icons
```

Notes:
- `dist/` is build output. If you change frontend assets, consider whether
  regenerated `dist/` files should be updated with `npm run build`.
- Icons in `icons/` are generated from `icon-base.svg` via
  `npm run generate-icons`.

## Backend setup and commands
```bash
cd artful-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Tests and CI
- No dedicated test suite is configured.
- CI runs `npm run build` and basic JS/HTML checks in `.github/workflows/ci.yml`.

## Environment notes
- Backend expects Supabase credentials in `artful-backend/.env`.
