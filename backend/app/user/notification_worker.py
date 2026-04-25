import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import UserSettings
from app.user.service import create_notification

logger = logging.getLogger(__name__)


async def run_digest_worker() -> None:
    while True:
        now = datetime.utcnow().strftime("%H:%M")
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(UserSettings).where(
                        UserSettings.email_alerts == True,  # noqa: E712
                        UserSettings.digest_hour == now,
                    )
                )
                due = list(result.scalars().all())
                for row in due:
                    await create_notification(
                        db,
                        user_id=row.user_id,
                        channel="email",
                        kind="digest",
                        message="Your Newsly daily digest is ready.",
                        status="queued",
                    )
            if due:
                logger.info("Queued %d digest notifications.", len(due))
        except Exception as exc:
            logger.warning("Digest worker cycle failed: %s", exc)

        await asyncio.sleep(60)
