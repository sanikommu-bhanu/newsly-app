import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import hash_password, verify_password
from app.models import (
    ArticleComment,
    CustomFeed,
    EditorPick,
    NotificationLog,
    PublisherControl,
    TakedownRequest,
    User,
    UserBookmark,
    UserFollow,
    UserInteraction,
    UserPreferences,
    UserProfile,
    UserSettings,
    UserSocialAccount,
)


async def get_user(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[UserProfile]:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def upsert_user_profile(
    db: AsyncSession,
    user_id: str,
    full_name: Optional[str] = None,
    bio: Optional[str] = None,
    preferred_language: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> UserProfile:
    profile = await get_user_profile(db, user_id)
    if profile is None:
        profile = UserProfile(id=str(uuid.uuid4()), user_id=user_id)
        db.add(profile)

    if full_name is not None:
        profile.full_name = full_name.strip() or None
    if bio is not None:
        profile.bio = bio.strip() or None
    if preferred_language is not None:
        profile.preferred_language = preferred_language
    if avatar_url is not None:
        profile.avatar_url = avatar_url.strip() or None

    await db.commit()
    await db.refresh(profile)
    return profile


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
    await db.execute(
        delete(UserBookmark).where(
            UserBookmark.user_id == user_id, UserBookmark.article_id == article_id
        )
    )
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
    action_score = {"read": 1.0, "share": 2.0, "bookmark": 2.5, "comment": 2.5}

    for row in interactions:
        boost = action_score.get(row.action, 1.0)
        if row.category:
            category_weights[row.category] = category_weights.get(row.category, 0.0) + boost
        if row.source:
            source_weights[row.source] = source_weights.get(row.source, 0.0) + boost

    return {"categories": category_weights, "sources": source_weights}


async def list_user_stats(db: AsyncSession, user_id: str) -> dict:
    reads = await db.execute(
        select(func.count(UserInteraction.id)).where(
            UserInteraction.user_id == user_id, UserInteraction.action == "read"
        )
    )
    shares = await db.execute(
        select(func.count(UserInteraction.id)).where(
            UserInteraction.user_id == user_id, UserInteraction.action == "share"
        )
    )
    bookmarks = await db.execute(
        select(func.count(UserBookmark.id)).where(UserBookmark.user_id == user_id)
    )
    comments = await db.execute(
        select(func.count(ArticleComment.id)).where(ArticleComment.user_id == user_id)
    )
    return {
        "articles_read": int(reads.scalar() or 0),
        "shares": int(shares.scalar() or 0),
        "bookmarks": int(bookmarks.scalar() or 0),
        "comments": int(comments.scalar() or 0),
    }


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


async def list_notifications(db: AsyncSession, user_id: str, limit: int = 50) -> List[NotificationLog]:
    result = await db.execute(
        select(NotificationLog)
        .where(NotificationLog.user_id == user_id)
        .order_by(desc(NotificationLog.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_follows(db: AsyncSession, user_id: str) -> List[UserFollow]:
    result = await db.execute(
        select(UserFollow)
        .where(UserFollow.user_id == user_id)
        .order_by(desc(UserFollow.created_at))
    )
    return list(result.scalars().all())


async def upsert_follow(
    db: AsyncSession, user_id: str, follow_type: str, target: str
) -> UserFollow:
    normalized = target.strip().lower()
    result = await db.execute(
        select(UserFollow).where(
            UserFollow.user_id == user_id,
            UserFollow.follow_type == follow_type,
            UserFollow.target == normalized,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = UserFollow(
            id=str(uuid.uuid4()),
            user_id=user_id,
            follow_type=follow_type,
            target=normalized,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def remove_follow(db: AsyncSession, user_id: str, follow_type: str, target: str) -> bool:
    normalized = target.strip().lower()
    result = await db.execute(
        select(UserFollow).where(
            UserFollow.user_id == user_id,
            UserFollow.follow_type == follow_type,
            UserFollow.target == normalized,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await db.execute(delete(UserFollow).where(UserFollow.id == row.id))
    await db.commit()
    return True


async def list_custom_feeds(db: AsyncSession, user_id: str) -> List[CustomFeed]:
    result = await db.execute(
        select(CustomFeed)
        .where(CustomFeed.user_id == user_id)
        .order_by(desc(CustomFeed.created_at))
    )
    return list(result.scalars().all())


async def add_custom_feed(
    db: AsyncSession, user_id: str, url: str, source_name: str, region_hint: str
) -> CustomFeed:
    result = await db.execute(
        select(CustomFeed).where(
            CustomFeed.user_id == user_id, CustomFeed.url == url.strip()
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.source_name = source_name.strip()
        row.region_hint = region_hint.strip() or "Global"
        row.is_active = True
    else:
        row = CustomFeed(
            id=str(uuid.uuid4()),
            user_id=user_id,
            url=url.strip(),
            source_name=source_name.strip(),
            region_hint=region_hint.strip() or "Global",
            is_active=True,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def remove_custom_feed(db: AsyncSession, user_id: str, feed_id: str) -> bool:
    result = await db.execute(
        select(CustomFeed).where(CustomFeed.user_id == user_id, CustomFeed.id == feed_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await db.execute(delete(CustomFeed).where(CustomFeed.id == feed_id))
    await db.commit()
    return True


async def add_comment(
    db: AsyncSession,
    article_id: str,
    user_id: str,
    username: str,
    body: str,
) -> ArticleComment:
    row = ArticleComment(
        id=str(uuid.uuid4()),
        article_id=article_id,
        user_id=user_id,
        username=username,
        body=body.strip(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def list_comments(db: AsyncSession, article_id: str, limit: int = 100) -> List[ArticleComment]:
    result = await db.execute(
        select(ArticleComment)
        .where(ArticleComment.article_id == article_id)
        .order_by(desc(ArticleComment.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


async def change_password(
    db: AsyncSession, user_id: str, current_password: str, new_password: str
) -> bool:
    user = await get_user(db, user_id)
    if user is None:
        return False
    if not verify_password(current_password, user.hashed_password):
        return False
    user.hashed_password = hash_password(new_password)
    await db.commit()
    return True


async def delete_user_account(db: AsyncSession, user_id: str) -> bool:
    user = await get_user(db, user_id)
    if user is None:
        return False

    await db.execute(delete(UserBookmark).where(UserBookmark.user_id == user_id))
    await db.execute(delete(UserInteraction).where(UserInteraction.user_id == user_id))
    await db.execute(delete(UserPreferences).where(UserPreferences.user_id == user_id))
    await db.execute(delete(UserSettings).where(UserSettings.user_id == user_id))
    await db.execute(delete(UserProfile).where(UserProfile.user_id == user_id))
    await db.execute(delete(UserFollow).where(UserFollow.user_id == user_id))
    await db.execute(delete(CustomFeed).where(CustomFeed.user_id == user_id))
    await db.execute(delete(NotificationLog).where(NotificationLog.user_id == user_id))
    await db.execute(delete(ArticleComment).where(ArticleComment.user_id == user_id))
    await db.execute(delete(UserSocialAccount).where(UserSocialAccount.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return True


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


async def list_editor_picks(db: AsyncSession) -> List[EditorPick]:
    result = await db.execute(
        select(EditorPick).order_by(EditorPick.rank.asc(), desc(EditorPick.created_at))
    )
    return list(result.scalars().all())


async def upsert_editor_pick(
    db: AsyncSession, article_id: str, title: str, source: str, note: Optional[str], rank: int
) -> EditorPick:
    result = await db.execute(select(EditorPick).where(EditorPick.article_id == article_id))
    row = result.scalar_one_or_none()
    if row is None:
        row = EditorPick(
            id=str(uuid.uuid4()),
            article_id=article_id,
            title=title,
            source=source,
            note=note,
            rank=rank,
        )
        db.add(row)
    else:
        row.title = title
        row.source = source
        row.note = note
        row.rank = rank
    await db.commit()
    await db.refresh(row)
    return row


async def remove_editor_pick(db: AsyncSession, pick_id: str) -> bool:
    result = await db.execute(select(EditorPick).where(EditorPick.id == pick_id))
    row = result.scalar_one_or_none()
    if row is None:
        return False
    await db.execute(delete(EditorPick).where(EditorPick.id == pick_id))
    await db.commit()
    return True


async def get_social_account(
    db: AsyncSession, provider: str, provider_user_id: str
) -> Optional[UserSocialAccount]:
    result = await db.execute(
        select(UserSocialAccount).where(
            UserSocialAccount.provider == provider,
            UserSocialAccount.provider_user_id == provider_user_id,
        )
    )
    return result.scalar_one_or_none()


async def upsert_social_account(
    db: AsyncSession, user_id: str, provider: str, provider_user_id: str, email: Optional[str]
) -> UserSocialAccount:
    result = await db.execute(
        select(UserSocialAccount).where(
            UserSocialAccount.provider == provider,
            UserSocialAccount.provider_user_id == provider_user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = UserSocialAccount(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
        )
        db.add(row)
    else:
        row.user_id = user_id
        row.email = email
    await db.commit()
    await db.refresh(row)
    return row
