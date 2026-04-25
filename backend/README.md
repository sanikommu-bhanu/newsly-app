# Newsly Backend

> Production-ready news aggregation API — real RSS data, JWT auth, AI enrichment.

---

## Architecture

```
newsly-backend/
├── main.py                  # FastAPI app + lifespan
├── requirements.txt
├── .env.example
└── app/
    ├── config.py            # Pydantic settings (env vars)
    ├── database.py          # Async SQLAlchemy + SQLite
    ├── models.py            # ORM: User, UserPreferences
    ├── schemas.py           # Pydantic request/response models
    ├── auth/
    │   ├── router.py        # POST /auth/signup  POST /auth/login
    │   └── service.py       # JWT, bcrypt, user CRUD
    ├── news/
    │   ├── router.py        # GET /news  GET /article/{id}
    │   ├── service.py       # Cache orchestration + filtering
    │   ├── fetcher.py       # Async RSS parsing (BBC, Reuters, The Hindu)
    │   ├── classifier.py    # Keyword category + region detection
    │   └── processor.py     # VADER tone · bias rules · Ollama summary
    └── user/
        ├── router.py        # GET/POST /user/preferences
        └── service.py       # DB upsert for preferences
```

---

## Data Sources

| Source | Feed count | Region |
|--------|-----------|--------|
| BBC News | 7 (top, world, tech, business, health, entertainment, sport) | Global |
| Reuters | 3 (top, business, technology) — legacy RSS, attempted | Global |
| The Hindu | 4 (default, national, business, sport) | India |

> **Reuters note:** Reuters removed public RSS in 2020. The legacy endpoint is
> attempted and silently skipped on failure. All other sources remain fully
> operational.

---

## Quick Start

### 1. Clone & install dependencies

```bash
git clone https://github.com/yourorg/newsly-backend
cd newsly-backend

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum change SECRET_KEY
```

### 3. (Optional) Install Ollama for AI summaries

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull phi          # ~1.6 GB download

# The server auto-starts; verify:
curl http://localhost:11434/api/tags
```

If Ollama is not available the API falls back to extractive summaries automatically.
Set `OLLAMA_ENABLED=false` in `.env` to skip the attempt entirely.

### 4. Run the server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Interactive docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

---

## API Reference

### Authentication

#### Register
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "alice@example.com",
  "username": "alice",
  "password": "strongpass123"
}
```
Returns `{ "access_token": "eyJ...", "token_type": "bearer" }`

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "alice@example.com",
  "password": "strongpass123"
}
```

---

### News

#### List articles
```http
GET /news?category=Technology&location=India&page=1&limit=20
```

| Query param | Required | Values |
|-------------|----------|--------|
| `category`  | No | Politics · Technology · Business · World · Health · Sports · Entertainment |
| `location`  | No | India · US · UK · China · Europe · Middle East · Australia · Canada · Global |
| `page`      | No | integer ≥ 1 (default 1) |
| `limit`     | No | 1–50 (default 20) |

**Example response article:**
```json
{
  "id": "a3f2c1d0e4b5...",
  "title": "India launches next-generation satellite",
  "description": "ISRO successfully placed a communication satellite...",
  "image_url": "https://ichef.bbci.co.uk/news/1024/cpsprodpb/...",
  "source": "BBC Technology",
  "published_at": "2025-01-15T10:30:00",
  "article_url": "https://www.bbc.com/news/technology-...",
  "category": "Technology",
  "region": "India",
  "summary": "India's ISRO launched a communication satellite on Thursday...",
  "tone": "Positive",
  "bias": "Center",
  "emotional_words": ["launch", "success", "breakthrough"]
}
```

#### Get article by ID
```http
GET /article/{id}
```

#### Force cache refresh (admin)
```http
POST /news/refresh
```

---

### User Preferences (JWT required)

#### Save preferences
```http
POST /user/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "location": "India",
  "categories": ["Technology", "Business"]
}
```

#### Retrieve preferences
```http
GET /user/preferences
Authorization: Bearer <token>
```

---

## AI Enrichment Pipeline

```
Article title + description
         │
         ├─► VADER sentiment ──────────► tone: Positive | Neutral | Negative
         │
         ├─► Source + keyword rules ──► bias: Left | Center-Left | Center | …
         │
         ├─► Emotion lexicon scan ────► emotional_words: ["hope", "crisis", …]
         │
         └─► Ollama phi (local LLM) ──► summary: 2–3 sentence AI summary
                   │
                   └─ (fallback: first 2 sentences of description)
```

### Tone (VADER)
VADER compound score → Positive (≥ 0.05) / Negative (≤ −0.05) / Neutral.
Zero model download. Runs in microseconds.

### Bias (rule-based)
Source-level heuristic augmented by keyword presence:
- BBC, Reuters → **Center**
- The Hindu → **Center-Left** (editorial lean)
- Individual article keywords can shift this (planned ML upgrade path)

### Emotional words
Scans title + description against a curated NRC-style lexicon (hope, fear,
anger, sadness, joy, surprise, trust, crisis, growth, conflict).

### Summary (Ollama phi)
Local `phi` model receives the title + description (≤ 700 tokens), produces a
2–3 sentence neutral summary. Concurrency is capped at 3 simultaneous Ollama
calls (semaphore) to avoid overwhelming the local server.
Timeout: 12 seconds → falls back gracefully.

---

## Cache Strategy

| Property | Value |
|----------|-------|
| Storage | In-memory Python dict |
| TTL | 900 seconds (15 minutes), configurable via `NEWS_CACHE_TTL` |
| Refresh | Lazy (on first request after expiry) + startup pre-warm |
| Dedup | MD5 hash of article URL |
| Max entries per feed | 15 |

The first API call after a cold start may take 10–30 seconds while feeds load
and Ollama processes summaries. Subsequent calls return instantly from cache.

---

## Migrating to Supabase (PostgreSQL)

1. Create a Supabase project and grab the connection string.
2. Install the async driver: `pip install asyncpg`
3. In `.env`, set:
   ```
   DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
   ```
4. Remove the `connect_args` SQLite workaround in `app/database.py`.
5. Restart the server — SQLAlchemy handles the rest.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (dev key) | JWT signing secret — **change in production** |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token TTL |
| `DATABASE_URL` | `sqlite+aiosqlite:///./newsly.db` | Database connection string |
| `OLLAMA_ENABLED` | `true` | Set `false` to skip AI summaries |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `phi` | Model name (phi, mistral, llama3, …) |
| `NEWS_CACHE_TTL` | `900` | Seconds before cache expires |

---

## Running Tests (coming soon)

```bash
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

---

## License

MIT — free for personal and commercial use with attribution.
