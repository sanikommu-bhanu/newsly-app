"""
News service — the single source of truth for all article data.

Flow:
  fetch_all_feeds()
      → classify_category() + detect_region()
      → enrich_articles_batch()  (tone, bias, summary, emotional words)
      → in-memory cache (TTL = NEWS_CACHE_TTL seconds)

The cache is refreshed lazily on the first request after expiry.
A background task at startup pre-warms it.
"""

import logging
import re
import time
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import aiohttp
from app.config import settings
from app.news.classifier import classify_category, detect_region
from app.news.fetcher import fetch_all_feeds, fetch_single_feed
from app.news.processor import enrich_articles_batch

logger = logging.getLogger(__name__)

# ── In-memory cache ───────────────────────────────────────────────────────────
_cache: Dict[str, dict] = {}       # article_id → enriched article dict
_cache_ts: float = 0.0             # unix timestamp of last refresh


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _cache_is_fresh() -> bool:
    return bool(_cache) and (time.monotonic() - _cache_ts) < settings.NEWS_CACHE_TTL


def _all_cached() -> List[dict]:
    return list(_cache.values())


# ── Refresh pipeline ──────────────────────────────────────────────────────────

async def refresh_articles() -> List[dict]:
    """
    Full pipeline: fetch → classify → enrich → cache.
    Replaces the in-memory cache atomically on success.
    """
    global _cache, _cache_ts
    logger.info("Starting article refresh pipeline…")

    raw_articles = await fetch_all_feeds()
    if not raw_articles:
        logger.warning("No articles fetched — keeping existing cache.")
        return _all_cached()

    # Classify each article in-place (CPU-bound but fast keyword matching)
    for article in raw_articles:
        text = article.get("_raw_text", "")
        article["category"] = classify_category(text)
        article["region"] = detect_region(
            text,
            article.get("source", ""),
            article.get("region_hint", "Global"),
        )

    # AI enrichment (async; Ollama calls may run concurrently)
    enriched = await enrich_articles_batch(raw_articles)

    # Atomic cache swap
    _cache = {a["id"]: a for a in enriched}
    _cache_ts = time.monotonic()

    logger.info("Article cache updated — %d articles stored.", len(_cache))
    return enriched


async def _ensure_cache() -> List[dict]:
    """Return cached articles; refresh lazily if stale."""
    if not _cache_is_fresh():
        return await refresh_articles()
    return _all_cached()


# ── Public API ────────────────────────────────────────────────────────────────

VALID_CATEGORIES = {
    "Politics", "Technology", "Business",
    "World", "Health", "Sports", "Entertainment",
}

VALID_REGIONS = {
    "India", "US", "UK", "China", "Europe",
    "Middle East", "Australia", "Canada", "Global",
}


async def get_articles(
    category: Optional[str] = None,
    location: Optional[str] = None,
    q: Optional[str] = None,
    user_profile: Optional[dict] = None,
    blocked_sources: Optional[set[str]] = None,
    source_limit_map: Optional[dict[str, int]] = None,
    preferred_categories: Optional[List[str]] = None,
    source: Optional[str] = None,
    tone: Optional[str] = None,
    bias: Optional[str] = None,
    hours: Optional[int] = None,
    extra_articles: Optional[List[dict]] = None,
    page: int = 1,
    limit: int = 20,
) -> List[dict]:
    articles = await _ensure_cache()
    if extra_articles:
        merged: List[dict] = []
        seen: set[str] = set()
        for article in extra_articles + articles:
            aid = article.get("id")
            if not aid or aid in seen:
                continue
            seen.add(aid)
            merged.append(article)
        articles = merged

    # ── Category filter ───────────────────────────────────────────────────────
    if category and category.strip().lower() not in ("all", ""):
        # Case-insensitive match
        category_normalised = category.strip().title()
        articles = [a for a in articles if a.get("category") == category_normalised]

    if blocked_sources:
        blocked_norm = {s.lower() for s in blocked_sources}
        articles = [
            a for a in articles if a.get("source", "").strip().lower() not in blocked_norm
        ]

    if source and source.strip():
        needle = source.strip().lower()
        articles = [a for a in articles if needle in (a.get("source", "").lower())]

    if q and q.strip():
        query = q.strip().lower()
        filtered: List[dict] = []
        for article in articles:
            title = (article.get("title") or "").lower()
            desc = (article.get("description") or "").lower()
            if query in title or query in desc:
                item = dict(article)
                item["highlight_title"] = _highlight(article.get("title", ""), query)
                item["highlight_description"] = _highlight(
                    article.get("description") or "", query
                )
                filtered.append(item)
        articles = filtered

    if tone and tone.strip():
        tone_norm = tone.strip().lower()
        articles = [a for a in articles if (a.get("tone") or "").lower() == tone_norm]

    if bias and bias.strip():
        bias_norm = bias.strip().lower()
        articles = [a for a in articles if (a.get("bias") or "").lower() == bias_norm]

    if hours and hours > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        filtered_hours: List[dict] = []
        for article in articles:
            published = article.get("published_at")
            if not published:
                continue
            try:
                ts = datetime.fromisoformat(published.replace("Z", "+00:00"))
            except ValueError:
                continue
            if ts >= cutoff:
                filtered_hours.append(article)
        articles = filtered_hours

    # ── Location prioritisation ───────────────────────────────────────────────
    # Articles whose region matches the user's location float to the top;
    # all others are still included (not dropped) for breadth.
    if location and location.strip().lower() not in ("global", "all", ""):
        loc = location.strip().title()
        matching = [a for a in articles if a.get("region", "Global") == loc]
        others = [a for a in articles if a.get("region", "Global") != loc]
        articles = matching + others

    # ── Sort newest-first ─────────────────────────────────────────────────────
    articles.sort(key=lambda x: x.get("published_at", ""), reverse=True)

    if preferred_categories:
        pref = {c.strip().lower() for c in preferred_categories if c and c.strip()}
        matched = [a for a in articles if a.get("category", "").lower() in pref]
        other = [a for a in articles if a.get("category", "").lower() not in pref]
        articles = matched + other

    # Personalization/diversity should happen after base recency ordering so it is not overwritten.
    articles = _rank_for_user(articles, location=location, user_profile=user_profile)
    articles = _enforce_source_limits(articles, source_limit_map or {})

    # ── Pagination ────────────────────────────────────────────────────────────
    start = (page - 1) * limit
    return articles[start : start + limit]


async def get_article_by_id(article_id: str) -> Optional[dict]:
    await _ensure_cache()
    return _cache.get(article_id)


async def get_total_count(
    category: Optional[str] = None,
    location: Optional[str] = None,
    q: Optional[str] = None,
    blocked_sources: Optional[set[str]] = None,
    source: Optional[str] = None,
    tone: Optional[str] = None,
    bias: Optional[str] = None,
    hours: Optional[int] = None,
    extra_articles: Optional[List[dict]] = None,
) -> int:
    articles = await _ensure_cache()
    if extra_articles:
        merged: List[dict] = []
        seen: set[str] = set()
        for article in extra_articles + articles:
            aid = article.get("id")
            if not aid or aid in seen:
                continue
            seen.add(aid)
            merged.append(article)
        articles = merged

    if category and category.strip().lower() not in ("all", ""):
        articles = [a for a in articles if a.get("category") == category.strip().title()]

    if blocked_sources:
        blocked_norm = {s.lower() for s in blocked_sources}
        articles = [
            a for a in articles if a.get("source", "").strip().lower() not in blocked_norm
        ]

    if source and source.strip():
        needle = source.strip().lower()
        articles = [a for a in articles if needle in (a.get("source", "").lower())]

    if q and q.strip():
        needle = q.strip().lower()
        articles = [
            a
            for a in articles
            if needle in (a.get("title") or "").lower()
            or needle in (a.get("description") or "").lower()
        ]

    if tone and tone.strip():
        tone_norm = tone.strip().lower()
        articles = [a for a in articles if (a.get("tone") or "").lower() == tone_norm]

    if bias and bias.strip():
        bias_norm = bias.strip().lower()
        articles = [a for a in articles if (a.get("bias") or "").lower() == bias_norm]

    if hours and hours > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        filtered_hours: List[dict] = []
        for article in articles:
            published = article.get("published_at")
            if not published:
                continue
            try:
                ts = datetime.fromisoformat(published.replace("Z", "+00:00"))
            except ValueError:
                continue
            if ts >= cutoff:
                filtered_hours.append(article)
        articles = filtered_hours

    # For location we count all articles (location only re-orders, does not filter)
    return len(articles)


def _highlight(text: str, query: str) -> str:
    if not text:
        return text
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    return pattern.sub(lambda m: f"<mark>{m.group(0)}</mark>", text)


def _rank_for_user(
    articles: List[dict], location: Optional[str], user_profile: Optional[dict]
) -> List[dict]:
    if not user_profile:
        return articles

    category_weights = user_profile.get("categories", {})
    source_weights = user_profile.get("sources", {})
    preferred_loc = (location or "").strip().title()

    def score(article: dict) -> float:
        total = 0.0
        category = article.get("category")
        source = article.get("source")
        region = article.get("region")
        if category in category_weights:
            total += category_weights[category] * 0.35
        if source in source_weights:
            total += source_weights[source] * 0.2
        if preferred_loc and preferred_loc not in ("Global", "All") and region == preferred_loc:
            total += 1.25
        return total

    with_score = [(score(a), i, a) for i, a in enumerate(articles)]
    with_score.sort(key=lambda x: (x[0], -x[1]), reverse=True)
    reranked = [a for _, __, a in with_score]
    return _diversify_sources(reranked)


def _diversify_sources(articles: List[dict]) -> List[dict]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    for article in articles:
        buckets[article.get("source", "Unknown")].append(article)

    interleaved: List[dict] = []
    while True:
        moved = False
        for source in list(buckets.keys()):
            if buckets[source]:
                interleaved.append(buckets[source].pop(0))
                moved = True
        if not moved:
            break
    return interleaved


def _enforce_source_limits(articles: List[dict], source_limit_map: dict[str, int]) -> List[dict]:
    if not source_limit_map:
        return articles
    counts: dict[str, int] = defaultdict(int)
    out: List[dict] = []
    for article in articles:
        source = article.get("source", "")
        limit = source_limit_map.get(source, 0)
        if limit > 0 and counts[source] >= limit:
            continue
        counts[source] += 1
        out.append(article)
    return out


async def get_related_articles(article_id: str, limit: int = 3) -> List[dict]:
    article = await get_article_by_id(article_id)
    if article is None:
        return []
    all_articles = await _ensure_cache()
    same_category = [
        a for a in all_articles if a["id"] != article_id and a.get("category") == article.get("category")
    ]
    same_source = [
        a for a in all_articles if a["id"] != article_id and a.get("source") == article.get("source")
    ]
    merged: List[dict] = []
    seen: set[str] = set()
    for row in same_category + same_source + all_articles:
        rid = row["id"]
        if rid == article_id or rid in seen:
            continue
        seen.add(rid)
        merged.append(row)
        if len(merged) >= limit:
            break
    return merged


async def get_trending_articles(limit: int = 10) -> List[dict]:
    articles = await _ensure_cache()
    scored: List[tuple[float, dict]] = []
    now = datetime.now(timezone.utc)
    for article in articles:
        published = article.get("published_at")
        age_hours = 999.0
        if published:
            try:
                age_hours = (now - datetime.fromisoformat(published.replace("Z", "+00:00"))).total_seconds() / 3600
            except ValueError:
                age_hours = 999.0
        recency_boost = max(0.0, 48 - min(age_hours, 48))
        emotion_boost = float(len(article.get("emotional_words") or []))
        score = recency_boost + emotion_boost
        scored.append((score, article))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [row for _, row in scored[:limit]]


async def get_recommended_articles(
    user_profile: Optional[dict],
    preferred_categories: Optional[List[str]],
    location: Optional[str],
    limit: int = 10,
    ) -> List[dict]:
    return await get_articles(
        category=None,
        location=location,
        q=None,
        user_profile=user_profile,
        preferred_categories=preferred_categories,
        page=1,
        limit=limit,
    )


async def build_custom_articles(custom_feeds: List[dict]) -> List[dict]:
    if not custom_feeds:
        return []
    async with aiohttp.ClientSession() as session:
        tasks = [
            fetch_single_feed(
                session,
                {
                    "url": feed["url"],
                    "source": feed["source_name"],
                    "region_hint": feed.get("region_hint", "Global"),
                },
            )
            for feed in custom_feeds
            if feed.get("url") and feed.get("source_name")
        ]
        if not tasks:
            return []
        batches = await asyncio.gather(*tasks, return_exceptions=True)

    raw_articles: List[dict] = []
    for batch in batches:
        if isinstance(batch, list):
            raw_articles.extend(batch)

    if not raw_articles:
        return []

    for article in raw_articles:
        text = article.get("_raw_text", "")
        article["category"] = classify_category(text)
        article["region"] = detect_region(
            text,
            article.get("source", ""),
            article.get("region_hint", "Global"),
        )
    enriched = await enrich_articles_batch(raw_articles)
    return enriched
