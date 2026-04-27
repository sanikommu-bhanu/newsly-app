from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_token
from app.database import get_db
from app.news.service import (
    build_custom_articles,
    get_article_by_id,
    get_articles,
    get_recommended_articles,
    get_related_articles,
    get_total_count,
    get_trending_articles,
    refresh_articles,
)
from app.schemas import (
    ArticleCommentCreate,
    ArticleCommentResponse,
    ArticleResponse,
    NewsResponse,
)
from app.user.service import (
    add_comment,
    get_user,
    interaction_profile,
    list_comments,
    list_custom_feeds,
    list_editor_picks,
    list_publisher_controls,
)

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)
_required_bearer = HTTPBearer()


def _estimate_read_time_minutes(article: dict) -> int:
    text = f"{article.get('title', '')} {article.get('description', '')} {article.get('summary', '')}"
    words = len([w for w in text.split() if w.strip()])
    return max(1, round(words / 220))


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
        read_time_minutes=_estimate_read_time_minutes(a),
    )


def _optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    if credentials is None:
        return None
    return decode_token(credentials.credentials)


def _required_user(
    credentials: HTTPAuthorizationCredentials = Depends(_required_bearer),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


@router.get(
    "/news",
    response_model=NewsResponse,
    summary="Get paginated, filtered news articles",
)
async def get_news(
    category: Optional[str] = Query(None, description="Filter by category"),
    location: Optional[str] = Query(None, description="Prioritise region"),
    q: Optional[str] = Query(None, description="Search query"),
    source: Optional[str] = Query(None, description="Filter by source substring"),
    tone: Optional[str] = Query(None, description="Filter by tone"),
    bias: Optional[str] = Query(None, description="Filter by bias"),
    hours: Optional[int] = Query(None, ge=1, le=168, description="Only recent N hours"),
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
    preferred_categories: list[str] = []
    if user and user.get("sub"):
        user_profile = await interaction_profile(db, user["sub"])
        preferred_categories = list(user_profile.get("categories", {}).keys())
        custom_feed_rows = await list_custom_feeds(db, user["sub"])
        custom_feeds = [
            {"url": row.url, "source_name": row.source_name, "region_hint": row.region_hint}
            for row in custom_feed_rows
            if row.is_active
        ]
    else:
        custom_feeds = []
    extra_articles = await build_custom_articles(custom_feeds) if custom_feeds else None

    articles = await get_articles(
        category=category,
        location=location,
        q=q,
        source=source,
        tone=tone,
        bias=bias,
        hours=hours,
        user_profile=user_profile,
        preferred_categories=preferred_categories,
        extra_articles=extra_articles,
        blocked_sources=blocked_sources,
        source_limit_map=source_limit_map,
        page=page,
        limit=limit,
    )
    total = await get_total_count(
        category=category,
        location=location,
        q=q,
        source=source,
        tone=tone,
        bias=bias,
        hours=hours,
        extra_articles=extra_articles,
        blocked_sources=blocked_sources,
    )

    return NewsResponse(
        total=total,
        page=page,
        limit=limit,
        articles=[_article_to_schema(a) for a in articles],
    )


@router.get("/news/trending", response_model=list[ArticleResponse], summary="Get trending articles")
async def trending_articles(limit: int = Query(10, ge=1, le=30)):
    rows = await get_trending_articles(limit=limit)
    return [_article_to_schema(a) for a in rows]


@router.get(
    "/news/recommendations",
    response_model=list[ArticleResponse],
    summary="Get personalized recommendations",
)
async def recommended_articles(
    limit: int = Query(10, ge=1, le=30),
    location: Optional[str] = Query(None),
    user: dict = Depends(_required_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await interaction_profile(db, user["sub"])
    preferred_categories = list(profile.get("categories", {}).keys())
    rows = await get_recommended_articles(
        user_profile=profile,
        preferred_categories=preferred_categories,
        location=location,
        limit=limit,
    )
    return [_article_to_schema(a) for a in rows]


@router.get("/news/editor-picks", response_model=list[ArticleResponse], summary="Get editor picks")
async def editor_picks(db: AsyncSession = Depends(get_db)):
    picks = await list_editor_picks(db)
    out: list[ArticleResponse] = []
    for pick in picks:
        article = await get_article_by_id(pick.article_id)
        if article is None:
            continue
        out.append(_article_to_schema(article))
    return out


@router.get(
    "/news/{article_id}/related",
    response_model=list[ArticleResponse],
    summary="Get related articles",
)
async def related_articles(article_id: str, limit: int = Query(3, ge=1, le=10)):
    rows = await get_related_articles(article_id, limit=limit)
    return [_article_to_schema(a) for a in rows]


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


@router.get(
    "/article/{article_id}/comments",
    response_model=list[ArticleCommentResponse],
    summary="List comments for an article",
)
async def article_comments(article_id: str, db: AsyncSession = Depends(get_db)):
    rows = await list_comments(db, article_id=article_id, limit=100)
    return [
        ArticleCommentResponse(
            id=row.id,
            article_id=row.article_id,
            user_id=row.user_id,
            username=row.username,
            body=row.body,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.post(
    "/article/{article_id}/comments",
    response_model=ArticleCommentResponse,
    summary="Post a comment",
)
async def create_article_comment(
    article_id: str,
    body: ArticleCommentCreate,
    user: dict = Depends(_required_user),
    db: AsyncSession = Depends(get_db),
):
    account = await get_user(db, user["sub"])
    if account is None:
        raise HTTPException(status_code=404, detail="User not found.")
    row = await add_comment(
        db,
        article_id=article_id,
        user_id=account.id,
        username=account.username,
        body=body.body,
    )
    return ArticleCommentResponse(
        id=row.id,
        article_id=row.article_id,
        user_id=row.user_id,
        username=row.username,
        body=row.body,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.post(
    "/news/refresh",
    summary="Force an immediate cache refresh (admin / internal use)",
    status_code=status.HTTP_200_OK,
)
async def force_refresh():
    articles = await refresh_articles()
    return {"message": "Cache refreshed.", "article_count": len(articles)}
