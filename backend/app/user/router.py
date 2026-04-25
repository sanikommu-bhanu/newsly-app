from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_token
from app.database import get_db
from app.schemas import (
    BookmarkResponse,
    BookmarkUpsert,
    InteractionCreate,
    NotificationTestRequest,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from app.user.service import (
    add_interaction,
    create_notification,
    delete_bookmark,
    get_preferences,
    get_settings,
    list_bookmarks,
    upsert_bookmark,
    upsert_preferences,
)

router = APIRouter()
_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


@router.post(
    "/preferences",
    response_model=UserPreferencesResponse,
    summary="Save user preferences and alert settings",
)
async def save_preferences(
    body: UserPreferencesUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    prefs, settings = await upsert_preferences(
        db,
        user_id=user_id,
        location=body.location or "Global",
        categories=body.categories or [],
        email_alerts=body.email_alerts,
        push_alerts=body.push_alerts,
        digest_hour=body.digest_hour,
        legal_accepted=body.legal_accepted,
    )
    return UserPreferencesResponse(
        location=prefs.location,
        categories=prefs.categories,
        email_alerts=settings.email_alerts,
        push_alerts=settings.push_alerts,
        digest_hour=settings.digest_hour,
        legal_accepted=settings.legal_accepted,
    )


@router.get(
    "/preferences",
    response_model=UserPreferencesResponse,
    summary="Retrieve user preferences",
)
async def fetch_preferences(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    prefs = await get_preferences(db, user_id)
    settings = await get_settings(db, user_id)

    if not prefs:
        return UserPreferencesResponse(
            location="Global",
            categories=[],
            email_alerts=bool(settings.email_alerts) if settings else False,
            push_alerts=bool(settings.push_alerts) if settings else False,
            digest_hour=settings.digest_hour if settings else "08:00",
            legal_accepted=bool(settings.legal_accepted) if settings else False,
        )

    return UserPreferencesResponse(
        location=prefs.location,
        categories=prefs.categories,
        email_alerts=bool(settings.email_alerts) if settings else False,
        push_alerts=bool(settings.push_alerts) if settings else False,
        digest_hour=settings.digest_hour if settings else "08:00",
        legal_accepted=bool(settings.legal_accepted) if settings else False,
    )


@router.get("/bookmarks", response_model=list[BookmarkResponse], summary="List user bookmarks")
async def fetch_bookmarks(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_bookmarks(db, current_user["sub"])
    return [
        BookmarkResponse(
            id=row.id,
            user_id=row.user_id,
            article_id=row.article_id,
            title=row.title,
            article_url=row.article_url,
            source=row.source,
            image_url=row.image_url,
            category=row.category,
            region=row.region,
            published_at=row.published_at,
        )
        for row in rows
    ]


@router.post("/bookmarks", response_model=BookmarkResponse, summary="Create or update bookmark")
async def save_bookmark(
    body: BookmarkUpsert,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await upsert_bookmark(db, current_user["sub"], body.model_dump())
    await add_interaction(
        db,
        user_id=current_user["sub"],
        article_id=body.article_id,
        action="bookmark",
        category=body.category,
        source=body.source,
    )
    return BookmarkResponse(
        id=row.id,
        user_id=row.user_id,
        article_id=row.article_id,
        title=row.title,
        article_url=row.article_url,
        source=row.source,
        image_url=row.image_url,
        category=row.category,
        region=row.region,
        published_at=row.published_at,
    )


@router.delete("/bookmarks/{article_id}", summary="Delete bookmark by article id")
async def remove_bookmark(
    article_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_bookmark(db, current_user["sub"], article_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Bookmark not found.")
    return {"message": "Bookmark removed."}


@router.post("/interactions", summary="Track user interaction events")
async def track_interaction(
    body: InteractionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await add_interaction(
        db,
        user_id=current_user["sub"],
        article_id=body.article_id,
        action=body.action,
        category=body.category,
        source=body.source,
    )
    return {"message": "Interaction tracked."}


@router.post("/notifications/test", summary="Create a test notification event")
async def create_test_notification(
    body: NotificationTestRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await create_notification(
        db,
        user_id=current_user["sub"],
        channel=body.channel,
        kind="test",
        message=body.message,
        status="queued",
    )
    return {"message": "Notification queued.", "notification_id": row.id}
