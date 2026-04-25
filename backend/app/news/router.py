from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_token
from app.database import get_db
from app.news.service import get_article_by_id, get_articles, get_total_count, refresh_articles
from app.schemas import ArticleResponse, NewsResponse
from app.user.service import interaction_profile, list_publisher_controls

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """Decode JWT if provided; return None for unauthenticated requests."""
    if credentials is None:
        return None
    return decode_token(credentials.credentials)


def _article_to_schema(a: dict) -> ArticleResponse:
    return ArticleResponse(
        id=a["id"],
        title=a["title"],
        description=a.get("description"),
        image_url=a.get("image_url"),
        source=a["source"],
        published_at=a.get("published_at"),
        article_url=a["article_url"],
        category=a.get("category", "World"),
        region=a.get("region", "Global"),
        summary=a.get("summary"),
        tone=a.get("tone"),
        bias=a.get("bias"),
        emotional_words=a.get("emotional_words", []),
        highlight_title=a.get("highlight_title"),
        highlight_description=a.get("highlight_description"),
    )


@router.get(
    "/news",
    response_model=NewsResponse,
    summary="Get paginated, filtered news articles",
    description=(
        "Returns articles from BBC, Reuters, and The Hindu enriched with "
        "AI-generated summaries, tone, bias, and emotional keywords.\n\n"
        "**category** — one of: Politics, Technology, Business, World, Health, Sports, Entertainment\n\n"
        "**location** — one of: India, US, UK, China, Europe, Middle East, Australia, Canada, Global"
    ),
)
async def get_news(
    category: Optional[str] = Query(
        None,
        description="Filter by category (case-insensitive)",
        example="Technology",
    ),
    location: Optional[str] = Query(
        None,
        description="Prioritise articles for this region",
        example="India",
    ),
    q: Optional[str] = Query(None, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=50, description="Articles per page"),
    user: Optional[dict] = Depends(_optional_user),
    db: AsyncSession = Depends(get_db),
):
    controls = await list_publisher_controls(db)
    blocked_sources = {c.source for c in controls if c.is_blocked}
    source_limit_map = {
        c.source: int(c.max_per_feed or "0")
        for c in controls
        if int(c.max_per_feed or "0") > 0
    }
    user_profile = None
    if user and user.get("sub"):
        user_profile = await interaction_profile(db, user["sub"])

    articles = await get_articles(
        category=category,
        location=location,
        q=q,
        user_profile=user_profile,
        blocked_sources=blocked_sources,
        source_limit_map=source_limit_map,
        page=page,
        limit=limit,
    )
    total = await get_total_count(
        category=category, location=location, q=q, blocked_sources=blocked_sources
    )

    return NewsResponse(
        total=total,
        page=page,
        limit=limit,
        articles=[_article_to_schema(a) for a in articles],
    )


@router.get(
    "/article/{article_id}",
    response_model=ArticleResponse,
    summary="Get a single article by its ID",
)
async def get_article(article_id: str):
    article = await get_article_by_id(article_id)
    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article '{article_id}' not found. It may have expired from the cache.",
        )
    return _article_to_schema(article)


@router.post(
    "/news/refresh",
    summary="Force an immediate cache refresh (admin / internal use)",
    status_code=status.HTTP_200_OK,
)
async def force_refresh():
    articles = await refresh_articles()
    return {"message": "Cache refreshed.", "article_count": len(articles)}
