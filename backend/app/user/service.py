import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    NotificationLog,
    PublisherControl,
    TakedownRequest,
    UserBookmark,
    UserInteraction,
    UserPreferences,
    UserSettings,
)


async def get_preferences(db: AsyncSession, user_id: str) -> Optional[UserPreferences]:
    result = await db.execute(
        select(UserPreferences).where(UserPreferences.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_settings(db: AsyncSession, user_id: str) -> Optional[UserSettings]:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    return result.scalar_one_or_none()


async def upsert_preferences(
    db: AsyncSession,
    user_id: str,
    location: str,
    categories: List[str],
    email_alerts: Optional[bool] = None,
    push_alerts: Optional[bool] = None,
    digest_hour: Optional[str] = None,
    legal_accepted: Optional[bool] = None,
) -> tuple[UserPreferences, UserSettings]:
    prefs = await get_preferences(db, user_id)
    if prefs:
        prefs.location = location
        prefs.categories = categories
    else:
        prefs = UserPreferences(
            id=str(uuid.uuid4()),
            user_id=user_id,
            location=location,
            categories=categories,
        )
        db.add(prefs)

    settings = await get_settings(db, user_id)
    if settings is None:
        settings = UserSettings(id=str(uuid.uuid4()), user_id=user_id)
        db.add(settings)

    if email_alerts is not None:
        settings.email_alerts = email_alerts
    if push_alerts is not None:
        settings.push_alerts = push_alerts
    if digest_hour:
        settings.digest_hour = digest_hour
    if legal_accepted is not None:
        settings.legal_accepted = legal_accepted

    await db.commit()
    await db.refresh(prefs)
    await db.refresh(settings)
    return prefs, settings


async def list_bookmarks(db: AsyncSession, user_id: str) -> List[UserBookmark]:
    result = await db.execute(
        select(UserBookmark)
        .where(UserBookmark.user_id == user_id)
        .order_by(desc(UserBookmark.created_at))
    )
    return list(result.scalars().all())


async def upsert_bookmark(db: AsyncSession, user_id: str, payload: dict) -> UserBookmark:
    result = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == user_id,
            UserBookmark.article_id == payload["article_id"],
        )
    )
    bookmark = result.scalar_one_or_none()
    if bookmark:
        bookmark.title = payload["title"]
        bookmark.article_url = payload["article_url"]
        bookmark.source = payload["source"]
        bookmark.image_url = payload.get("image_url")
        bookmark.category = payload.get("category")
        bookmark.region = payload.get("region")
        bookmark.published_at = payload.get("published_at")
    else:
        bookmark = UserBookmark(
            id=str(uuid.uuid4()),
            user_id=user_id,
            article_id=payload["article_id"],
            title=payload["title"],
            article_url=payload["article_url"],
            source=payload["source"],
            image_url=payload.get("image_url"),
            category=payload.get("category"),
            region=payload.get("region"),
            published_at=payload.get("published_at"),
        )
        db.add(bookmark)

    await db.commit()
    await db.refresh(bookmark)
    return bookmark


async def delete_bookmark(db: AsyncSession, user_id: str, article_id: str) -> bool:
    result = await db.execute(
        select(UserBookmark).where(
            UserBookmark.user_id == user_id, UserBookmark.article_id == article_id
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        return False
    await db.delete(bookmark)
    await db.commit()
    return True


async def add_interaction(
    db: AsyncSession,
    user_id: str,
    article_id: str,
    action: str,
    category: Optional[str] = None,
    source: Optional[str] = None,
) -> None:
    db.add(
        UserInteraction(
            id=str(uuid.uuid4()),
            user_id=user_id,
            article_id=article_id,
            action=action,
            category=category,
            source=source,
        )
    )
    await db.commit()


async def interaction_profile(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(UserInteraction)
        .where(UserInteraction.user_id == user_id)
        .order_by(desc(UserInteraction.created_at))
        .limit(300)
    )
    interactions = list(result.scalars().all())
    category_weights: dict[str, float] = {}
    source_weights: dict[str, float] = {}
    action_score = {"read": 1.0, "share": 2.0, "bookmark": 2.5}

    for row in interactions:
        boost = action_score.get(row.action, 1.0)
        if row.category:
            category_weights[row.category] = category_weights.get(row.category, 0.0) + boost
        if row.source:
            source_weights[row.source] = source_weights.get(row.source, 0.0) + boost

    return {"categories": category_weights, "sources": source_weights}


async def create_notification(
    db: AsyncSession, user_id: str, channel: str, kind: str, message: str, status: str = "queued"
) -> NotificationLog:
    row = NotificationLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        channel=channel,
        kind=kind,
        message=message,
        status=status,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_publisher_controls(db: AsyncSession) -> List[PublisherControl]:
    result = await db.execute(select(PublisherControl).order_by(PublisherControl.source.asc()))
    return list(result.scalars().all())


async def set_publisher_control(
    db: AsyncSession, source: str, is_blocked: bool, max_per_feed: int, policy_status: str
) -> PublisherControl:
    result = await db.execute(
        select(PublisherControl).where(PublisherControl.source == source)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = PublisherControl(
            id=str(uuid.uuid4()),
            source=source,
            is_blocked=is_blocked,
            max_per_feed=str(max_per_feed),
            policy_status=policy_status,
        )
        db.add(row)
    else:
        row.is_blocked = is_blocked
        row.max_per_feed = str(max_per_feed)
        row.policy_status = policy_status
    await db.commit()
    await db.refresh(row)
    return row


async def create_takedown(db: AsyncSession, payload: dict) -> TakedownRequest:
    row = TakedownRequest(
        id=str(uuid.uuid4()),
        source=payload["source"],
        article_url=payload["article_url"],
        reason=payload["reason"],
        requester_email=payload["requester_email"],
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_takedowns(db: AsyncSession) -> List[TakedownRequest]:
    result = await db.execute(select(TakedownRequest).order_by(desc(TakedownRequest.created_at)))
    return list(result.scalars().all())


async def resolve_takedown(db: AsyncSession, takedown_id: str) -> Optional[TakedownRequest]:
    result = await db.execute(select(TakedownRequest).where(TakedownRequest.id == takedown_id))
    row = result.scalar_one_or_none()
    if row is None:
        return None
    row.status = "resolved"
    row.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return row
