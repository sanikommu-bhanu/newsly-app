from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    PublisherControlResponse,
    PublisherControlUpdate,
    TakedownCreate,
    TakedownResolve,
    TakedownResponse,
)
from app.user.service import (
    create_takedown,
    list_publisher_controls,
    list_takedowns,
    resolve_takedown,
    set_publisher_control,
)

router = APIRouter()


@router.get("/publishers", response_model=list[PublisherControlResponse])
async def get_publishers(db: AsyncSession = Depends(get_db)):
    rows = await list_publisher_controls(db)
    return [
        PublisherControlResponse(
            source=row.source,
            is_blocked=row.is_blocked,
            max_per_feed=int(row.max_per_feed or "0"),
            policy_status=row.policy_status,
        )
        for row in rows
    ]


@router.post("/publishers", response_model=PublisherControlResponse)
async def upsert_publisher(body: PublisherControlUpdate, db: AsyncSession = Depends(get_db)):
    row = await set_publisher_control(
        db,
        source=body.source,
        is_blocked=body.is_blocked,
        max_per_feed=body.max_per_feed,
        policy_status=body.policy_status,
    )
    return PublisherControlResponse(
        source=row.source,
        is_blocked=row.is_blocked,
        max_per_feed=int(row.max_per_feed or "0"),
        policy_status=row.policy_status,
    )


@router.post("/takedowns", response_model=TakedownResponse)
async def create_takedown_request(body: TakedownCreate, db: AsyncSession = Depends(get_db)):
    row = await create_takedown(db, body.model_dump())
    return TakedownResponse(
        id=row.id,
        source=row.source,
        article_url=row.article_url,
        reason=row.reason,
        requester_email=row.requester_email,
        status=row.status,
    )


@router.get("/takedowns", response_model=list[TakedownResponse])
async def get_takedowns(db: AsyncSession = Depends(get_db)):
    rows = await list_takedowns(db)
    return [
        TakedownResponse(
            id=row.id,
            source=row.source,
            article_url=row.article_url,
            reason=row.reason,
            requester_email=row.requester_email,
            status=row.status,
        )
        for row in rows
    ]


@router.post("/takedowns/{takedown_id}/resolve", response_model=TakedownResponse)
async def mark_takedown_resolved(
    takedown_id: str, body: TakedownResolve, db: AsyncSession = Depends(get_db)
):
    if body.status != "resolved":
        raise HTTPException(status_code=400, detail="Only 'resolved' status is supported.")
    row = await resolve_takedown(db, takedown_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Takedown request not found.")
    row.resolved_at = row.resolved_at or datetime.now(timezone.utc)
    return TakedownResponse(
        id=row.id,
        source=row.source,
        article_url=row.article_url,
        reason=row.reason,
        requester_email=row.requester_email,
        status=row.status,
    )
