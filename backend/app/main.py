import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.news.service import refresh_articles
from app.auth.router import router as auth_router
from app.news.router import router as news_router
from app.user.router import router as user_router
from app.admin.router import router as admin_router
from app.user.notification_worker import run_digest_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("newsly")


def _parse_cors_origins(raw: str) -> list[str]:
    origins: list[str] = []
    for item in raw.split(","):
        origin = item.strip().rstrip("/")
        if origin:
            origins.append(origin)
    # Preserve order while removing duplicates
    return list(dict.fromkeys(origins))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Initialising database…")
    await init_db()

    logger.info("Pre-warming article cache (background task)…")
    # Fire-and-forget — server accepts connections immediately while feeds load
    asyncio.create_task(refresh_articles())
    digest_task = asyncio.create_task(run_digest_worker())

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    try:
        digest_task.cancel()
        await digest_task
    except asyncio.CancelledError:
        pass
    logger.info("Newsly shutting down.")


app = FastAPI(
    title="Newsly API",
    version="1.0.0",
    description=(
        "Mobile-first news aggregator.\n\n"
        "Real-time articles from **BBC**, **Reuters**, and **The Hindu**, "
        "enriched with AI-powered summaries, tone analysis, bias detection, "
        "and emotional keywords."
    ),
    contact={"name": "Newsly", "url": "https://newsly.app"},
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
cors_origins = _parse_cors_origins(settings.CORS_ORIGINS)
cors_origin_regex = settings.CORS_ORIGIN_REGEX or None
logger.info("CORS origins: %s", cors_origins)
if cors_origin_regex:
    logger.info("CORS regex: %s", cors_origin_regex)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(news_router, tags=["News"])
app.include_router(user_router, prefix="/user", tags=["User"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])


# ── Health & metadata ─────────────────────────────────────────────────────────

@app.get("/health", tags=["Meta"], summary="Health check")
async def health():
    return {"status": "ok", "service": "Newsly API", "version": "1.0.0"}


@app.get("/", tags=["Meta"], summary="API root")
async def root():
    return {
        "service": "Newsly API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }
