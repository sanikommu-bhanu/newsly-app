from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth Schemas ──────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        value = v.strip()
        if len(value) < 3 or len(value) > 32:
            raise ValueError("Username must be 3–32 characters")
        return value

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class SocialGoogleLogin(BaseModel):
    id_token: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User / Profile Schemas ────────────────────────────────────────────────────


class UserPreferencesUpdate(BaseModel):
    location: Optional[str] = "Global"
    categories: Optional[List[str]] = []
    email_alerts: Optional[bool] = None
    push_alerts: Optional[bool] = None
    digest_hour: Optional[str] = None
    legal_accepted: Optional[bool] = None


class UserPreferencesResponse(BaseModel):
    location: str
    categories: List[str]
    email_alerts: bool = False
    push_alerts: bool = False
    digest_hour: str = "08:00"
    legal_accepted: bool = False


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    preferred_language: Optional[Literal["en", "hi"]] = None
    avatar_url: Optional[str] = None


class UserStatsResponse(BaseModel):
    articles_read: int
    shares: int
    bookmarks: int
    comments: int


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    preferred_language: Literal["en", "hi"] = "en"
    avatar_url: Optional[str] = None
    stats: UserStatsResponse
    follows: List[str] = []


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def new_password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class DeleteAccountRequest(BaseModel):
    confirm_text: str


class FollowCreate(BaseModel):
    follow_type: Literal["topic", "user"]
    target: str

    @field_validator("target")
    @classmethod
    def target_present(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("Target cannot be empty")
        return value


class FollowResponse(BaseModel):
    id: str
    follow_type: Literal["topic", "user"]
    target: str
    created_at: str


class NotificationLogResponse(BaseModel):
    id: str
    channel: str
    kind: str
    message: str
    status: str
    created_at: str


class NotificationTestRequest(BaseModel):
    channel: Literal["email", "push"]
    message: str = "Test notification from Newsly"


class BookmarkUpsert(BaseModel):
    article_id: str
    title: str
    article_url: str
    source: str
    image_url: Optional[str] = None
    category: Optional[str] = None
    region: Optional[str] = None
    published_at: Optional[str] = None


class BookmarkResponse(BookmarkUpsert):
    id: str
    user_id: str


class InteractionCreate(BaseModel):
    article_id: str
    action: Literal["read", "share", "bookmark", "comment"]
    category: Optional[str] = None
    source: Optional[str] = None


class CustomFeedCreate(BaseModel):
    url: str
    source_name: str
    region_hint: Optional[str] = "Global"


class CustomFeedResponse(BaseModel):
    id: str
    url: str
    source_name: str
    region_hint: str
    is_active: bool
    created_at: str


class DigestPreviewResponse(BaseModel):
    headline: str
    summary: str
    article_count: int
    articles: List[dict]


# ── Admin Schemas ──────────────────────────────────────────────────────────────


class PublisherControlUpdate(BaseModel):
    source: str
    is_blocked: bool = False
    max_per_feed: int = 0
    policy_status: str = "active"


class PublisherControlResponse(BaseModel):
    source: str
    is_blocked: bool
    max_per_feed: int
    policy_status: str


class TakedownCreate(BaseModel):
    source: str
    article_url: str
    reason: str
    requester_email: EmailStr


class TakedownResolve(BaseModel):
    status: Literal["resolved"]


class TakedownResponse(BaseModel):
    id: str
    source: str
    article_url: str
    reason: str
    requester_email: str
    status: str


class EditorPickUpdate(BaseModel):
    article_id: str
    title: str
    source: str
    note: Optional[str] = None
    rank: int = 0


class EditorPickResponse(BaseModel):
    id: str
    article_id: str
    title: str
    source: str
    note: Optional[str] = None
    rank: int


# ── News / Article Schemas ─────────────────────────────────────────────────────


class ArticleCommentCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def body_required(cls, v: str) -> str:
        value = v.strip()
        if len(value) < 2:
            raise ValueError("Comment is too short")
        if len(value) > 1000:
            raise ValueError("Comment is too long")
        return value


class ArticleCommentResponse(BaseModel):
    id: str
    article_id: str
    user_id: str
    username: str
    body: str
    created_at: str


class ArticleResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    source: str
    published_at: Optional[str] = None
    article_url: str
    category: str
    region: str = "Global"
    summary: Optional[str] = None
    tone: Optional[str] = None
    bias: Optional[str] = None
    emotional_words: Optional[List[str]] = []
    highlight_title: Optional[str] = None
    highlight_description: Optional[str] = None
    read_time_minutes: Optional[int] = 1

    class Config:
        from_attributes = True


class NewsResponse(BaseModel):
    total: int
    page: int
    limit: int
    articles: List[ArticleResponse]

