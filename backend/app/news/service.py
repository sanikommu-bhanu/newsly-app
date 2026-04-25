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
from collections import defaultdict
from typing import Dict, List, Optional

from app.config import settings
from app.news.classifier import classify_category, detect_region
from app.news.fetcher import fetch_all_feeds
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
    page: int = 1,
    limit: int = 20,
) -> List[dict]:
    articles = await _ensure_cache()

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
) -> int:
    articles = await _ensure_cache()

    if category and category.strip().lower() not in ("all", ""):
        articles = [a for a in articles if a.get("category") == category.strip().title()]

    if blocked_sources:
        blocked_norm = {s.lower() for s in blocked_sources}
        articles = [
            a for a in articles if a.get("source", "").strip().lower() not in blocked_norm
        ]

    if q and q.strip():
        needle = q.strip().lower()
        articles = [
            a
            for a in articles
            if needle in (a.get("title") or "").lower()
            or needle in (a.get("description") or "").lower()
        ]

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
