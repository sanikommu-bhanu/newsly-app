import uuid
from sqlalchemy import Boolean, Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, unique=True, index=True)
    location = Column(String, default="Global", nullable=False)
    # JSON list of category strings, e.g. ["Technology", "Business"]
    categories = Column(JSON, default=list, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, unique=True, index=True)
    email_alerts = Column(Boolean, default=False, nullable=False)
    push_alerts = Column(Boolean, default=False, nullable=False)
    digest_hour = Column(String, default="08:00", nullable=False)
    legal_accepted = Column(Boolean, default=False, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserBookmark(Base):
    __tablename__ = "user_bookmarks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    article_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    article_url = Column(String, nullable=False)
    source = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    category = Column(String, nullable=True)
    region = Column(String, nullable=True)
    published_at = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserInteraction(Base):
    __tablename__ = "user_interactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    article_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)  # read | share | bookmark
    category = Column(String, nullable=True)
    source = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PublisherControl(Base):
    __tablename__ = "publisher_controls"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String, nullable=False, unique=True, index=True)
    is_blocked = Column(Boolean, default=False, nullable=False)
    max_per_feed = Column(String, default="0", nullable=False)  # 0 means unlimited
    policy_status = Column(String, default="active", nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class TakedownRequest(Base):
    __tablename__ = "takedown_requests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String, nullable=False)
    article_url = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    requester_email = Column(String, nullable=False)
    status = Column(String, default="open", nullable=False)  # open | resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    channel = Column(String, nullable=False)  # email | push
    kind = Column(String, nullable=False)  # digest | breaking | test
    message = Column(Text, nullable=False)
    status = Column(String, default="queued", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    preferred_language = Column(String, default="en", nullable=False)
    avatar_url = Column(String, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserFollow(Base):
    __tablename__ = "user_follows"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    follow_type = Column(String, nullable=False)  # topic | user
    target = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ArticleComment(Base):
    __tablename__ = "article_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    article_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    username = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class EditorPick(Base):
    __tablename__ = "editor_picks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    article_id = Column(String, nullable=False, unique=True, index=True)
    title = Column(String, nullable=False)
    source = Column(String, nullable=False)
    note = Column(String, nullable=True)
    rank = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CustomFeed(Base):
    __tablename__ = "custom_feeds"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    url = Column(String, nullable=False)
    source_name = Column(String, nullable=False)
    region_hint = Column(String, default="Global", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserSocialAccount(Base):
    __tablename__ = "user_social_accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)  # google
    provider_user_id = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
