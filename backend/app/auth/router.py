import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import SocialGoogleLogin, Token, UserCreate, UserLogin
from app.auth.service import (
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_email,
    get_user_by_username,
    verify_google_id_token,
)
from app.user.service import upsert_social_account

router = APIRouter()


async def _next_available_username(db: AsyncSession, email: str, preferred: str | None = None) -> str:
    if preferred:
        base = re.sub(r"[^a-zA-Z0-9_]", "", preferred.strip())[:20]
    else:
        base = re.sub(r"[^a-zA-Z0-9_]", "", email.split("@")[0])[:20]
    if len(base) < 3:
        base = f"user{base}".ljust(3, "0")
    candidate = base
    idx = 1
    while await get_user_by_username(db, candidate):
        suffix = str(idx)
        candidate = f"{base[:max(1, 20 - len(suffix))]}{suffix}"
        idx += 1
    return candidate


@router.post(
    "/signup",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(body: UserCreate, db: AsyncSession = Depends(get_db)):
    if await get_user_by_email(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    if await get_user_by_username(db, body.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken.",
        )

    user = await create_user(db, body.email, body.username, body.password)
    token = create_access_token({"sub": user.id, "email": user.email})
    return Token(access_token=token)


@router.post(
    "/login",
    response_model=Token,
    summary="Login and receive a JWT",
)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user.id, "email": user.email})
    return Token(access_token=token)


@router.post(
    "/social/google",
    response_model=Token,
    summary="Login / signup with Google id_token",
)
async def google_login(body: SocialGoogleLogin, db: AsyncSession = Depends(get_db)):
    try:
        payload = await verify_google_id_token(body.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    email = payload["email"].lower()
    user = await get_user_by_email(db, email)
    if user is None:
        username = await _next_available_username(
            db,
            email=email,
            preferred=payload.get("name"),
        )
        generated_password = f"google-oauth-{payload['sub']}"
        user = await create_user(db, email, username, generated_password)

    await upsert_social_account(
        db,
        user_id=user.id,
        provider="google",
        provider_user_id=payload["sub"],
        email=email,
    )
    token = create_access_token({"sub": user.id, "email": user.email})
    return Token(access_token=token)
