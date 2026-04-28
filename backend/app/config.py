from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )
    
    # ── Auth ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "newsly-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GOOGLE_OAUTH_CLIENT_ID: Optional[str] = None

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./newsly.db"

    # ── Ollama ────────────────────────────────────────────────────────────────
    OLLAMA_ENABLED: bool = True
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    # ── News API ───────────────────────────────────────────────────────────────
    NEWS_API_KEY: Optional[str] = None
    # ── News Cache ────────────────────────────────────────────────────────────
    NEWS_CACHE_TTL: int = 900  # seconds (15 minutes)
    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://localhost:3001,"
        "http://127.0.0.1:3000,"
        "http://127.0.0.1:3001,"
        "https://newsly-seven-jet.vercel.app"
    )
    CORS_ORIGIN_REGEX: Optional[str] = r"https://.*\.vercel\.app"


settings = Settings()
