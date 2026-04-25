"""
AI enrichment pipeline for each article.

┌──────────────┬─────────────────────────────────────────────────┐
│  Component   │  Implementation                                 │
├──────────────┼─────────────────────────────────────────────────┤
│  Summary     │  Ollama phi (local LLM) → extractive fallback  │
│  Tone        │  VADER compound score → Positive/Neutral/Negative│
│  Bias        │  Source mapping + headline keywords             │
│  Emotions    │  NRC-style emotion lexicon keyword scan         │
└──────────────┴─────────────────────────────────────────────────┘
"""

import asyncio
import logging
import re
from typing import Dict, List, Optional, Tuple

import httpx
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.config import settings
from app.news.classifier import get_source_bias

logger = logging.getLogger(__name__)

# ── Singletons ────────────────────────────────────────────────────────────────
_vader = SentimentIntensityAnalyzer()

# Limit concurrent Ollama calls so we don't flood a local model server
_ollama_semaphore = asyncio.Semaphore(3)

# ── Emotion lexicon ───────────────────────────────────────────────────────────
# Curated from NRC Emotion Lexicon + journalism-specific terms.
EMOTION_LEXICON: Dict[str, List[str]] = {
    "hope":     ["hope", "hopeful", "optimistic", "aspire", "promising", "bright"],
    "fear":     ["fear", "threat", "danger", "alarming", "risk", "terrify", "dread"],
    "anger":    ["anger", "outrage", "fury", "condemn", "protest", "backlash", "rage"],
    "sadness":  ["tragedy", "death", "loss", "grieve", "mourn", "sorrow", "victim"],
    "joy":      ["victory", "win", "celebrate", "triumph", "success", "achieve", "breakthrough"],
    "surprise": ["shock", "unexpected", "suddenly", "reveal", "stunning", "surprise", "astonish"],
    "trust":    ["support", "cooperate", "confirm", "approve", "unite", "partnership"],
    "crisis":   ["crisis", "collapse", "emergency", "disaster", "catastrophe", "critical"],
    "growth":   ["growth", "expand", "surge", "rise", "boom", "record", "gain"],
    "conflict": ["war", "attack", "bomb", "military", "clashes", "strike", "conflict"],
}

# Flat set for fast membership testing
ALL_EMOTION_WORDS: set = {w for words in EMOTION_LEXICON.values() for w in words}


# ── Tone detection ────────────────────────────────────────────────────────────

def detect_tone(text: str) -> str:
    """
    Use VADER compound score to classify tone.
      ≥  0.05  →  Positive
      ≤ -0.05  →  Negative
      else     →  Neutral
    """
    score = _vader.polarity_scores(text)["compound"]
    if score >= 0.05:
        return "Positive"
    if score <= -0.05:
        return "Negative"
    return "Neutral"


# ── Emotional word extraction ─────────────────────────────────────────────────

def extract_emotional_words(text: str, max_words: int = 5) -> List[str]:
    """Return up to max_words distinct emotional words found in the text."""
    tokens = re.findall(r"\b[a-z]+\b", text.lower())
    found: List[str] = []
    seen: set = set()

    for token in tokens:
        if token in ALL_EMOTION_WORDS and token not in seen:
            found.append(token)
            seen.add(token)
        if len(found) >= max_words:
            break

    return found


# ── Summary — Ollama ──────────────────────────────────────────────────────────

async def _call_ollama(text: str) -> Optional[str]:
    prompt = (
        "You are a news editor. Summarise the following news article in exactly "
        "2-3 concise sentences. Be factual and neutral. Do not add opinions or "
        "ask follow-up questions.\n\n"
        f"Article:\n{text[:700]}\n\nSummary:"
    )
    async with _ollama_semaphore:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "num_predict": 130,
                            "temperature": 0.25,
                            "top_p": 0.9,
                        },
                    },
                )
                if resp.status_code == 200:
                    raw = resp.json().get("response", "").strip()
                    # Collapse whitespace and trim to 400 chars
                    return re.sub(r"\s+", " ", raw)[:400] if raw else None
        except httpx.TimeoutException:
            logger.debug("Ollama timed out for article — using fallback summary.")
        except Exception as exc:
            logger.debug("Ollama unavailable (%s) — using fallback summary.", exc)
    return None


def _extractive_summary(title: str, description: str) -> str:
    """Simple extractive fallback: first 2 sentences of the description."""
    combined = description or title
    sentences = re.split(r"(?<=[.!?])\s+", combined.strip())
    sentences = [s for s in sentences if len(s) > 30]
    if not sentences:
        return (title or combined)[:250]
    return " ".join(sentences[:2])


async def generate_summary(title: str, description: str, raw_text: str) -> str:
    if settings.OLLAMA_ENABLED:
        result = await _call_ollama(raw_text or f"{title}. {description}")
        if result:
            return result
    return _extractive_summary(title, description)


# ── Per-article enrichment ────────────────────────────────────────────────────

async def enrich_article(article: Dict) -> Dict:
    """
    Accepts a raw article dict (from fetcher), returns the same dict
    augmented with: tone, bias, emotional_words, summary.
    """
    title = article.get("title", "")
    description = article.get("description", "") or ""
    raw_text = article.get("_raw_text", f"{title}. {description}")
    source = article.get("source", "")

    analysis_text = f"{title}. {description}"

    tone = detect_tone(analysis_text)
    bias = get_source_bias(source)
    emotional_words = extract_emotional_words(analysis_text)
    summary = await generate_summary(title, description, raw_text)

    return {
        **article,
        "tone": tone,
        "bias": bias,
        "emotional_words": emotional_words,
        "summary": summary,
    }


# ── Batch enrichment ──────────────────────────────────────────────────────────

async def enrich_articles_batch(articles: List[Dict]) -> List[Dict]:
    """Enrich all articles concurrently; failed enrichments get safe defaults."""
    tasks = [enrich_article(a) for a in articles]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    enriched: List[Dict] = []
    for idx, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning("Enrichment failed for article %s: %s", articles[idx].get("id"), result)
            enriched.append(
                {
                    **articles[idx],
                    "tone": "Neutral",
                    "bias": "Center",
                    "emotional_words": [],
                    "summary": _extractive_summary(
                        articles[idx].get("title", ""),
                        articles[idx].get("description", "") or "",
                    ),
                }
            )
        else:
            enriched.append(result)

    return enriched
