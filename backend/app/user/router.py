import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import decode_token
from app.database import get_db
from app.news.service import get_articles
from app.schemas import (
    BookmarkResponse,
    BookmarkUpsert,
    ChangePasswordRequest,
    CustomFeedCreate,
    CustomFeedResponse,
    DeleteAccountRequest,
    DigestPreviewResponse,
    FollowCreate,
    FollowResponse,
    InteractionCreate,
    NotificationLogResponse,
    NotificationTestRequest,
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserProfileResponse,
    UserProfileUpdate,
    UserStatsResponse,
)
from app.user.service import (
    add_custom_feed,
    add_interaction,
    change_password,
    create_notification,
    delete_bookmark,
    delete_user_account,
    get_preferences,
    get_settings,
    get_user,
    get_user_profile,
    interaction_profile,
    list_bookmarks,
    list_custom_feeds,
    list_follows,
    list_notifications,
    list_user_stats,
    remove_custom_feed,
    remove_follow,
    upsert_bookmark,
    upsert_follow,
    upsert_preferences,
    upsert_user_profile,
)

router = APIRouter()
_bearer = HTTPBearer()


def _dt(value: Optional[datetime]) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()


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


@router.get("/profile", response_model=UserProfileResponse, summary="Get user profile")
async def fetch_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user(db, current_user["sub"])
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    profile = await get_user_profile(db, user.id)
    stats = await list_user_stats(db, user.id)
    follows = await list_follows(db, user.id)
    return UserProfileResponse(
        user_id=user.id,
        email=user.email,
        username=user.username,
        full_name=profile.full_name if profile else None,
        bio=profile.bio if profile else None,
        preferred_language=(
            profile.preferred_language if profile and profile.preferred_language in ("en", "hi") else "en"
        ),
        avatar_url=profile.avatar_url if profile else None,
        stats=UserStatsResponse(**stats),
        follows=[f.target for f in follows if f.follow_type == "topic"],
    )


@router.patch("/profile", response_model=UserProfileResponse, summary="Update user profile")
async def update_profile(
    body: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user(db, current_user["sub"])
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    await upsert_user_profile(
        db,
        user_id=user.id,
        full_name=body.full_name,
        bio=body.bio,
        preferred_language=body.preferred_language,
        avatar_url=body.avatar_url,
    )
    return await fetch_profile(current_user=current_user, db=db)


@router.post("/change-password", summary="Change user password")
async def update_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await change_password(
        db,
        user_id=current_user["sub"],
        current_password=body.current_password,
        new_password=body.new_password,
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    return {"message": "Password updated."}


@router.delete("/account", summary="Delete user account")
async def remove_account(
    body: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm_text.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm.')
    ok = await delete_user_account(db, current_user["sub"])
    if not ok:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"message": "Account deleted."}


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


@router.get("/follows", response_model=list[FollowResponse], summary="List followed topics/users")
async def fetch_follows(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_follows(db, current_user["sub"])
    return [
        FollowResponse(
            id=row.id,
            follow_type=row.follow_type,
            target=row.target,
            created_at=_dt(row.created_at),
        )
        for row in rows
    ]


@router.post("/follows", response_model=FollowResponse, summary="Follow a topic or user")
async def create_follow(
    body: FollowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await upsert_follow(
        db,
        user_id=current_user["sub"],
        follow_type=body.follow_type,
        target=body.target,
    )
    return FollowResponse(
        id=row.id,
        follow_type=row.follow_type,
        target=row.target,
        created_at=_dt(row.created_at),
    )


@router.delete("/follows", summary="Unfollow a topic or user")
async def delete_follow(
    follow_type: str = Query(..., pattern="^(topic|user)$"),
    target: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await remove_follow(db, current_user["sub"], follow_type=follow_type, target=target)
    if not ok:
        raise HTTPException(status_code=404, detail="Follow target not found.")
    return {"message": "Unfollowed."}


@router.get("/custom-feeds", response_model=list[CustomFeedResponse], summary="List custom RSS feeds")
async def fetch_custom_feeds(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_custom_feeds(db, current_user["sub"])
    return [
        CustomFeedResponse(
            id=row.id,
            url=row.url,
            source_name=row.source_name,
            region_hint=row.region_hint,
            is_active=bool(row.is_active),
            created_at=_dt(row.created_at),
        )
        for row in rows
    ]


@router.post("/custom-feeds", response_model=CustomFeedResponse, summary="Add a custom RSS feed")
async def create_custom_feed(
    body: CustomFeedCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await add_custom_feed(
        db,
        user_id=current_user["sub"],
        url=body.url,
        source_name=body.source_name,
        region_hint=body.region_hint or "Global",
    )
    return CustomFeedResponse(
        id=row.id,
        url=row.url,
        source_name=row.source_name,
        region_hint=row.region_hint,
        is_active=bool(row.is_active),
        created_at=_dt(row.created_at),
    )


@router.delete("/custom-feeds/{feed_id}", summary="Remove a custom RSS feed")
async def delete_custom_feed(
    feed_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await remove_custom_feed(db, current_user["sub"], feed_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Feed not found.")
    return {"message": "Custom feed removed."}


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


@router.get("/bookmarks/export", summary="Export bookmarks as CSV")
async def export_bookmarks(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_bookmarks(db, current_user["sub"])
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["article_id", "title", "source", "category", "region", "article_url", "published_at"]
    )
    for row in rows:
        writer.writerow(
            [
                row.article_id,
                row.title,
                row.source,
                row.category or "",
                row.region or "",
                row.article_url,
                row.published_at or "",
            ]
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="newsly-bookmarks.csv"'
        },
    )


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


@router.get("/notifications", response_model=list[NotificationLogResponse], summary="List notifications")
async def fetch_notifications(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
):
    rows = await list_notifications(db, current_user["sub"], limit=limit)
    return [
        NotificationLogResponse(
            id=row.id,
            channel=row.channel,
            kind=row.kind,
            message=row.message,
            status=row.status,
            created_at=_dt(row.created_at),
        )
        for row in rows
    ]


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


@router.get("/newsletter/digest", response_model=DigestPreviewResponse, summary="Preview newsletter digest")
async def preview_digest(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prefs = await get_preferences(db, current_user["sub"])
    profile = await interaction_profile(db, current_user["sub"])
    location = prefs.location if prefs else None
    categories = prefs.categories if prefs else []

    articles = await get_articles(
        category=None,
        location=location,
        q=None,
        user_profile=profile,
        page=1,
        limit=5,
        preferred_categories=categories,
    )
    if not articles:
        return DigestPreviewResponse(
            headline="Your daily briefing is quiet today",
            summary="No fresh articles matched your preferences right now.",
            article_count=0,
            articles=[],
        )

    top_categories = [a.get("category", "World") for a in articles[:3]]
    headline = f"Top stories for {location or 'Global'}"
    summary = (
        f"Today's digest focuses on {', '.join(top_categories)} with {len(articles)} selected stories."
    )
    return DigestPreviewResponse(
        headline=headline,
        summary=summary,
        article_count=len(articles),
        articles=articles,
    )
