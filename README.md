# Newsly — AI-Powered News Aggregator

A minimal news aggregator that combines RSS headlines with optional NewsAPI enrichment, powered by FastAPI and Next.js.

## What this update includes
- RSS feeds remain the primary source.
- Optional `NEWS_API_KEY` support for NewsAPI enrichment.
- Deduplicated merge of RSS and NewsAPI articles.
- Guaranteed article images with placeholder fallback.
- Backend startup fixed for `python -m uvicorn app.main:app --reload --port 8000`.
- Frontend API base URL defaults to `http://localhost:8000`.
- Graceful fallback when APIs fail or environment variables are missing.
- Saved bookmarks, article sharing, and related-story discovery.
- Legal center pages (`/legal`, `/legal/terms`, `/legal/privacy`) and explicit signup consent.
- Source-credibility badges and stronger attribution-first article UX.
- Local alert preferences (push/email toggles) and basic product analytics counters.

## Setup

### Backend
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and edit values as needed.

Start the backend server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend is available at `http://localhost:3000`.

## Environment Variables

### Frontend
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend
Create `backend/.env`:
```env
SECRET_KEY=newsly-dev-secret-please-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
DATABASE_URL=sqlite+aiosqlite:///./newsly.db
NEWS_API_KEY=
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
NEWS_CACHE_TTL=900
```

- `NEWS_API_KEY` is optional.
- If missing, the backend continues with RSS-only mode.
- `OLLAMA_ENABLED=true` enables optional Ollama summaries.

## API Usage

### Fetch paginated news
`GET http://localhost:8000/news`

Query parameters:
- `category` — optional filter, e.g. `Technology`
- `location` — optional region preference, e.g. `India`
- `page` — optional page number, default `1`
- `limit` — optional page size, default `20`

### Fetch a single article
`GET http://localhost:8000/article/{id}`

### Health check
`GET http://localhost:8000/health`

### Refresh cache
`POST http://localhost:8000/news/refresh`

## Notes

- The backend uses RSS first and enriches it with NewsAPI results when `NEWS_API_KEY` is configured.
- Duplicate articles are removed by stable URL hashing.
- `image_url` is always populated; missing images fall back to a placeholder.
- The frontend uses `NEXT_PUBLIC_API_URL` and defaults to `http://localhost:8000`.
- The app handles API failures gracefully and avoids blank screens.

## Legal and Compliance

- Newsly is an aggregation interface, not a republishing platform.
- The app shows headlines, short excerpts, and source metadata, then links users to the original publisher page.
- Full article ownership remains with the original publishers.
- Excerpts are intentionally capped to short snippet length in backend processing.
- Keep source attribution visible in the UI and avoid removing publisher names or source links.

Recommended operational policy:

- Review each feed/API provider terms of use before production deployment.
- Remove or block any source immediately if required by provider policy.
- Publish a contact method for rights holders in your production site policy pages.

## Project Structure

```
newsly/
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── auth/
│   │   ├── news/
│   │   └── user/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # Next.js app
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── types/
└── README.md
```

## Run commands

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
