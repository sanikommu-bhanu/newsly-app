"""
Async RSS feed fetcher for BBC, Reuters, and The Hindu.

Fetches feeds concurrently, extracts media images, cleans HTML,
and normalises each entry into a flat dictionary ready for classification.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import aiohttp
import feedparser

from app.config import settings

logger = logging.getLogger(__name__)

# ── Feed registry ─────────────────────────────────────────────────────────────
# Reuters discontinued public RSS in 2020; the /reuters/topNews endpoint is the
# last surviving legacy path — we attempt it and gracefully skip on failure.
RSS_FEEDS: List[Dict] = [
    # BBC — multiple topic feeds
    {"url": "http://feeds.bbci.co.uk/news/rss.xml",                        "source": "BBC News",          "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/news/world/rss.xml",                  "source": "BBC World",         "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/news/technology/rss.xml",             "source": "BBC Technology",    "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/news/business/rss.xml",               "source": "BBC Business",      "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/news/health/rss.xml",                 "source": "BBC Health",        "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "source": "BBC Entertainment", "region_hint": "Global"},
    {"url": "http://feeds.bbci.co.uk/sport/rss.xml",                       "source": "BBC Sport",         "region_hint": "Global"},
    # Reuters (legacy path — attempted, skipped on failure)
    {"url": "https://feeds.reuters.com/reuters/topNews",                   "source": "Reuters",           "region_hint": "Global"},
    {"url": "https://feeds.reuters.com/reuters/businessNews",              "source": "Reuters Business",  "region_hint": "Global"},
    {"url": "https://feeds.reuters.com/reuters/technologyNews",            "source": "Reuters Technology","region_hint": "Global"},
    # The Hindu — India-focused
    {"url": "https://www.thehindu.com/feeder/default.rss",                 "source": "The Hindu",         "region_hint": "India"},
    {"url": "https://www.thehindu.com/news/national/feeder/default.rss",   "source": "The Hindu National","region_hint": "India"},
    {"url": "https://www.thehindu.com/business/feeder/default.rss",        "source": "The Hindu Business","region_hint": "India"},
    {"url": "https://www.thehindu.com/sport/feeder/default.rss",           "source": "The Hindu Sports",  "region_hint": "India"},
]

HEADERS = {
    "User-Agent": "Newsly/1.0 (+https://newsly.app; RSS aggregator; news@newsly.app)"
}
FETCH_TIMEOUT = aiohttp.ClientTimeout(total=15)
MAX_ENTRIES_PER_FEED = 15
NEWSAPI_ENDPOINT = "https://newsapi.org/v2/top-headlines"
NEWSAPI_PAGE_SIZE = 30
PLACEHOLDER_IMAGE = (
    "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20"
    "width%3D%271200%27%20height%3D%27750%27%20viewBox%3D%270%200%201200%20750%27%3E%3C"
    "defs%3E%3ClinearGradient%20id%3D%27g%27%20x1%3D%270%27%20x2%3D%271%27%20y1%3D%270%27"
    "%20y2%3D%271%27%3E%3Cstop%20offset%3D%270%25%27%20stop-color%3D%27%23e5e7eb%27%2F%3E"
    "%3Cstop%20offset%3D%27100%25%27%20stop-color%3D%27%23dbeafe%27%2F%3E%3C%2FlinearGradient"
    "%3E%3C%2Fdefs%3E%3Crect%20width%3D%271200%27%20height%3D%27750%27%20fill%3D%27url%28%23"
    "g%29%27%2F%3E%3Crect%20x%3D%27120%27%20y%3D%27110%27%20width%3D%27960%27%20height%3D"
    "%27530%27%20rx%3D%2728%27%20fill%3D%27%23ffffff%27%20opacity%3D%270.72%27%2F%3E%3Ctext"
    "%20x%3D%2750%25%27%20y%3D%2750%25%27%20text-anchor%3D%27middle%27%20dominant-baseline"
    "%3D%27middle%27%20font-family%3D%27Arial%2C%20sans-serif%27%20font-size%3D%2772%27%20"
    "fill%3D%27%231f2937%27%3ENewsly%3C%2Ftext%3E%3C%2Fsvg%3E"
)
# Keep public excerpts short to avoid reproducing full publisher content.
MAX_DESCRIPTION_LEN = 320
MAX_RAW_TEXT_LEN = 1400


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_article_id(url: str) -> str:
    """Stable MD5-based ID from the article URL."""
    return hashlib.md5(url.encode()).hexdigest()


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def combine_text_chunks(chunks: List[str], max_len: int = MAX_DESCRIPTION_LEN) -> str:
    """Merge and deduplicate content fragments into one readable paragraph."""
    merged: List[str] = []
    seen: set = set()

    for chunk in chunks:
        cleaned = strip_html(chunk or "")
        if not cleaned:
            continue

        # NewsAPI often appends trailing markers like "[+123 chars]".
        cleaned = re.sub(r"\[\+\d+\schars\]$", "", cleaned).strip()
        if not cleaned:
            continue

        key = cleaned.lower()
        if key in seen:
            continue

        seen.add(key)
        merged.append(cleaned)

    return " ".join(merged)[:max_len].strip()


def build_rss_description(entry: feedparser.FeedParserDict) -> str:
    chunks: List[str] = [
        getattr(entry, "summary", "") or "",
        getattr(entry, "description", "") or "",
        getattr(entry, "subtitle", "") or "",
    ]

    content = getattr(entry, "content", None) or []
    for block in content:
        if isinstance(block, dict):
            chunks.append(block.get("value", ""))

    return combine_text_chunks(chunks)


def build_newsapi_description(item: Dict) -> str:
    return combine_text_chunks(
        [
            item.get("description") or "",
            item.get("content") or "",
        ]
    )


def normalize_image_url(url: Optional[str]) -> Optional[str]:
    """Upgrade common low-res news image URLs to clearer variants where possible."""
    if not url:
        return None

    candidate = url.strip()
    if not candidate:
        return None

    if candidate.startswith("//"):
        candidate = f"https:{candidate}"

    # BBC images commonly ship with low-resolution paths like .../ace/standard/240/...
    candidate = re.sub(
        r"(https?://[^/]*bbci\.co\.uk/ace/(?:standard|ws)/)(\d+)(/)",
        lambda m: f"{m.group(1)}1024{m.group(3)}",
        candidate,
        flags=re.IGNORECASE,
    )

    try:
        parts = urlsplit(candidate)
        if not parts.scheme or not parts.netloc:
            return candidate

        changed = False
        query_pairs = parse_qsl(parts.query, keep_blank_values=True)
        updated_pairs = []

        for key, value in query_pairs:
            key_lower = key.lower()
            if value.isdigit() and key_lower in {"w", "width"} and int(value) < 900:
                updated_pairs.append((key, "1200"))
                changed = True
            elif value.isdigit() and key_lower in {"h", "height"} and int(value) < 500:
                updated_pairs.append((key, "800"))
                changed = True
            else:
                updated_pairs.append((key, value))

        if changed:
            return urlunsplit(
                (
                    parts.scheme,
                    parts.netloc,
                    parts.path,
                    urlencode(updated_pairs, doseq=True),
                    parts.fragment,
                )
            )
    except Exception:
        return candidate

    return candidate


def extract_image(entry: feedparser.FeedParserDict) -> Optional[str]:
    """Try every common RSS image location in priority order."""
    # 1. media:content
    if hasattr(entry, "media_content"):
        for m in entry.media_content:
            if m.get("type", "").startswith("image") and m.get("url"):
                return m["url"]
            if m.get("url"):
                return m["url"]

    # 2. media:thumbnail
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        url = entry.media_thumbnail[0].get("url")
        if url:
            return url

    # 3. enclosures
    if hasattr(entry, "enclosures"):
        for enc in entry.enclosures:
            if enc.get("type", "").startswith("image"):
                return enc.get("href") or enc.get("url")

    # 4. <img> tag buried in summary HTML
    summary = getattr(entry, "summary", "") or ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary, re.IGNORECASE)
    if match:
        candidate = match.group(1)
        # Skip tiny tracker pixels
        if not re.search(r"(1x1|pixel|tracker|beacon)", candidate, re.IGNORECASE):
            return candidate

    return None


def parse_date(entry: feedparser.FeedParserDict) -> str:
    for attr in ("published_parsed", "updated_parsed"):
        value = getattr(entry, attr, None)
        if value:
            try:
                return datetime(*value[:6]).isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


# ── Per-feed fetch ────────────────────────────────────────────────────────────

async def fetch_single_feed(
    session: aiohttp.ClientSession,
    feed_meta: Dict,
) -> List[Dict]:
    url = feed_meta["url"]
    source = feed_meta["source"]
    region_hint = feed_meta["region_hint"]
    articles: List[Dict] = []

    try:
        async with session.get(url, headers=HEADERS, timeout=FETCH_TIMEOUT) as resp:
            if resp.status != 200:
                logger.warning("Feed %s returned HTTP %s — skipping.", source, resp.status)
                return []
            raw_bytes = await resp.read()

        feed = feedparser.parse(raw_bytes)

        for entry in feed.entries[:MAX_ENTRIES_PER_FEED]:
            link = getattr(entry, "link", None)
            raw_title = getattr(entry, "title", None)
            if not link or not raw_title:
                continue

            title = strip_html(raw_title)
            description = build_rss_description(entry)
            if not description:
                description = f"{title}. Read the full report from {source}."

            articles.append(
                {
                    "id": make_article_id(link),
                    "title": title,
                    "description": description or None,
                    "image_url": normalize_image_url(extract_image(entry)),
                    "source": source,
                    "published_at": parse_date(entry),
                    "article_url": link,
                    "region_hint": region_hint,
                    # Combined text used for classification & AI processing
                    "_raw_text": f"{title}. {description}"[:MAX_RAW_TEXT_LEN],
                }
            )

    except asyncio.TimeoutError:
        logger.warning("Timeout fetching feed: %s", source)
    except Exception as exc:
        logger.error("Error fetching feed %s: %s", source, exc)

    return articles


async def fetch_newsapi_articles(session: aiohttp.ClientSession) -> List[Dict]:
    """Fetch additional articles from NewsAPI when an API key is configured."""
    if not settings.NEWS_API_KEY:
        return []

    articles: List[Dict] = []
    headers = {**HEADERS, "X-Api-Key": settings.NEWS_API_KEY}
    params = {
        "language": "en",
        "pageSize": NEWSAPI_PAGE_SIZE,
    }

    try:
        async with session.get(NEWSAPI_ENDPOINT, headers=headers, params=params, timeout=FETCH_TIMEOUT) as resp:
            if resp.status != 200:
                logger.warning(
                    "NewsAPI returned HTTP %s — skipping additional articles.",
                    resp.status,
                )
                return []
            payload = await resp.json()

        if payload.get("status") != "ok":
            logger.warning(
                "NewsAPI response invalid: %s — %s",
                payload.get("status"),
                payload.get("message"),
            )
            return []

        for item in payload.get("articles", []):
            link = item.get("url")
            raw_title = item.get("title")
            if not link or not raw_title:
                continue

            title = strip_html(raw_title)
            description = build_newsapi_description(item)
            source_name = (item.get("source") or {}).get("name", "NewsAPI")
            if not description:
                description = f"{title}. Read the full report from {source_name}."

            articles.append(
                {
                    "id": make_article_id(link),
                    "title": title,
                    "description": description or None,
                    "image_url": normalize_image_url(item.get("urlToImage")),
                    "source": source_name,
                    "published_at": item.get("publishedAt") or datetime.now(timezone.utc).isoformat(),
                    "article_url": link,
                    "region_hint": "Global",
                    "_raw_text": f"{title}. {description}"[:MAX_RAW_TEXT_LEN],
                }
            )

    except asyncio.TimeoutError:
        logger.warning("NewsAPI request timed out — falling back to RSS only.")
    except Exception as exc:
        logger.warning("NewsAPI fetch failed: %s — falling back to RSS only.", exc)

    return articles


# ── Public entry point ────────────────────────────────────────────────────────

async def fetch_all_feeds() -> List[Dict]:
    """Fetch configured RSS feeds and NewsAPI articles then merge deduplicated results."""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_single_feed(session, meta) for meta in RSS_FEEDS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        feed_articles: List[Dict] = []
        for batch in results:
            if not isinstance(batch, list):
                continue
            feed_articles.extend(batch)

        newsapi_articles = await fetch_newsapi_articles(session)

    seen_ids: set = set()
    articles: List[Dict] = []
    article_index: Dict[str, Dict] = {}

    for article in feed_articles:
        if article["id"] not in seen_ids:
            seen_ids.add(article["id"])
            articles.append(article)
            article_index[article["id"]] = article

    for article in newsapi_articles:
        existing = article_index.get(article["id"])
        if existing:
            if not existing.get("image_url") and article.get("image_url"):
                existing["image_url"] = article["image_url"]
            continue

        if article["id"] not in seen_ids:
            seen_ids.add(article["id"])
            articles.append(article)
            article_index[article["id"]] = article

    for article in articles:
        image = normalize_image_url(article.get("image_url"))
        article["image_url"] = image or PLACEHOLDER_IMAGE

    sources_count = len(RSS_FEEDS)
    logger.info(
        "Fetched %d unique articles from %d RSS feeds + %d NewsAPI extras.",
        len(articles),
        sources_count,
        len(newsapi_articles),
    )
    return articles
