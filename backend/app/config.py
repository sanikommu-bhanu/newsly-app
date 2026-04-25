from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Auth ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "newsly-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
