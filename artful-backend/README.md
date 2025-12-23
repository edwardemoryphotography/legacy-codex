# Legacy Codex Backend API

A FastAPI backend for the Edward Emory Legacy Codex PWA.

## Setup Instructions

1. **Create and activate virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase credentials:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your public anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (kept secure)

4. **Run the API**
   ```bash
   uvicorn app.main:app --reload
   ```

The API will be available at `http://localhost:8000` with docs at `/docs`.

## Project Structure

```
artful-backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── router.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   ├── services/
│   │   └── __init__.py
│   ├── __init__.py
│   └── main.py
├── .env
├── .env.example
├── .gitignore
└── requirements.txt
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/v1/` - API root
