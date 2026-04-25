"""
Lightweight keyword-based classifier.

- classify_category  →  one of the 7 Newsly categories
- detect_region      →  geographic tag (India, US, UK, Europe, …, Global)
- get_source_bias    →  Left | Center-Left | Center | Center-Right | Right
"""

from typing import Dict, List

# ── Category keywords ─────────────────────────────────────────────────────────
# Ordered by specificity; first non-zero match wins in a score tie.
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Sports": [
        "cricket", "ipl", "bcci", "football", "soccer", "tennis", "wimbledon",
        "basketball", "nba", "nfl", "baseball", "mlb", "nhl", "hockey", "golf",
        "formula 1", "f1", "grand prix", "olympics", "paralympics", "commonwealth games",
        "fifa", "premier league", "la liga", "bundesliga", "rugby", "boxing",
        "ufc", "mma", "wrestler", "athlete", "stadium", "match", "tournament",
        "championship", "league", "coach", "referee", "medal", "gold medal",
        "silver medal", "bronze medal", "sport", "player", "team"
    ],
    "Technology": [
        "artificial intelligence", "machine learning", "deep learning", "neural network",
        "chatgpt", "openai", "gemini", "llm", "large language model",
        "apple", "google", "microsoft", "amazon", "meta", "nvidia", "samsung",
        "iphone", "android", "smartphone", "laptop", "chip", "semiconductor",
        "startup", "silicon valley", "venture capital", "ipo tech",
        "cybersecurity", "hack", "data breach", "ransomware", "malware",
        "blockchain", "crypto", "bitcoin", "ethereum", "nft", "web3",
        "electric vehicle", "ev", "tesla", "spacex", "elon musk", "satellite",
        "cloud computing", "aws", "azure", "5g", "quantum computing",
        "robot", "automation", "software", "app", "digital", "internet",
        "tech", "gadget", "wearable", "drone"
    ],
    "Business": [
        "gdp", "inflation", "interest rate", "federal reserve", "fed", "rbi",
        "stock market", "wall street", "nasdaq", "s&p 500", "dow jones",
        "sensex", "nifty", "bse", "nse",
        "trade war", "tariff", "export", "import", "supply chain",
        "merger", "acquisition", "ipo", "shares", "dividend",
        "profit", "revenue", "earnings", "quarterly results",
        "recession", "unemployment", "jobs report",
        "oil price", "crude", "commodity", "gold price",
        "rupee", "dollar", "euro", "currency", "forex",
        "bank", "finance", "investment", "hedge fund",
        "budget", "tax", "fiscal", "deficit", "debt",
        "retail", "e-commerce", "amazon", "walmart", "economy", "business", "company",
        "corporate", "ceo", "founder", "entrepreneur"
    ],
    "Health": [
        "covid", "coronavirus", "pandemic", "epidemic", "outbreak",
        "vaccine", "vaccination", "booster", "pfizer", "moderna", "astrazeneca",
        "who", "world health organization", "cdc", "fda", "ema",
        "cancer", "tumor", "chemotherapy", "diabetes", "insulin",
        "heart disease", "stroke", "blood pressure", "cholesterol",
        "mental health", "depression", "anxiety", "therapy",
        "hospital", "doctor", "nurse", "surgeon", "icu",
        "clinical trial", "drug", "medicine", "pharmaceutical",
        "nutrition", "diet", "obesity", "fitness",
        "infection", "virus", "bacteria", "antibiotic",
        "health", "disease", "medical", "patient", "symptom", "treatment"
    ],
    "Entertainment": [
        "movie", "film", "cinema", "box office", "trailer", "premiere",
        "bollywood", "hollywood", "tollywood",
        "oscar", "bafta", "grammy", "emmy", "cannes", "sundance",
        "actor", "actress", "director", "producer",
        "singer", "album", "song", "music", "concert", "tour",
        "netflix", "disney+", "hbo", "streaming", "tv show", "series", "season",
        "celebrity", "gossip", "red carpet",
        "video game", "gaming", "esports", "playstation", "xbox", "nintendo",
        "fashion", "style", "designer", "runway",
        "art", "exhibition", "gallery", "museum",
        "comedy", "stand-up", "podcast", "influencer", "entertainment"
    ],
    "Politics": [
        "president", "vice president", "prime minister", "chancellor",
        "parliament", "congress", "senate", "house of representatives", "lok sabha", "rajya sabha",
        "election", "vote", "ballot", "referendum", "poll",
        "democrat", "republican", "labour", "tory", "conservative", "liberal",
        "bjp", "aap", "congress party", "samajwadi",
        "modi", "biden", "trump", "sunak", "macron", "scholz",
        "cabinet", "minister", "secretary of state", "diplomat",
        "law", "legislation", "bill", "constitution", "supreme court",
        "foreign policy", "diplomacy", "sanctions", "treaty", "summit",
        "protest", "rally", "campaign", "political party", "opposition",
        "government", "administration", "policy", "political"
    ],
    "World": [
        "war", "conflict", "military", "army", "air force", "navy",
        "attack", "airstrike", "bomb", "missile", "weapon",
        "terrorism", "terror", "isis", "al-qaeda", "jihad",
        "ceasefire", "peace talks", "negotiation",
        "refugee", "displacement", "humanitarian",
        "climate change", "global warming", "carbon", "emissions", "cop",
        "natural disaster", "earthquake", "tsunami", "hurricane", "cyclone",
        "flood", "drought", "wildfire",
        "united nations", "un", "nato", "g7", "g20", "imf", "world bank",
        "human rights", "genocide", "sanctions", "embargo",
        "migration", "border", "visa", "asylum",
        "ukraine", "russia", "china", "taiwan", "north korea", "iran",
        "middle east", "africa", "global", "international", "world"
    ],
}

# ── Region keywords ───────────────────────────────────────────────────────────
REGION_KEYWORDS: Dict[str, List[str]] = {
    "India": [
        "india", "indian", "new delhi", "delhi", "mumbai", "bangalore", "bengaluru",
        "chennai", "kolkata", "hyderabad", "pune", "ahmedabad",
        "modi", "bjp", "aap", "congress", "lok sabha", "rajya sabha",
        "rbi", "sebi", "sensex", "nifty", "bse", "nse",
        "rupee", "ipl", "bcci", "isro", "bollywood",
        "pakistan", "nepal", "sri lanka", "bangladesh", "south asia"
    ],
    "US": [
        "united states", "america", "american", "us congress",
        "washington dc", "new york", "california", "texas", "florida",
        "biden", "trump", "harris", "democrat", "republican",
        "federal reserve", "wall street", "nasdaq", "dow jones", "s&p",
        "nba", "nfl", "mlb", "nhl", "hollywood", "silicon valley",
        "white house", "pentagon", "fbi", "cia", "supreme court us"
    ],
    "UK": [
        "united kingdom", "britain", "british", "england", "london",
        "scotland", "wales", "northern ireland",
        "parliament", "prime minister uk", "sunak", "starmer",
        "labour", "tory", "conservative party", "bank of england", "ftse",
        "premier league", "bbc", "nhs"
    ],
    "China": [
        "china", "chinese", "beijing", "shanghai", "hong kong", "macau",
        "xi jinping", "ccp", "communist party china",
        "taiwan strait", "yuan", "renminbi", "belt and road", "bri", "byd"
    ],
    "Europe": [
        "europe", "european union", "eu", "eurozone", "euro",
        "germany", "berlin", "france", "paris", "italy", "rome",
        "spain", "madrid", "netherlands", "brussels", "ecb",
        "scholz", "macron", "von der leyen"
    ],
    "Middle East": [
        "israel", "palestine", "gaza", "west bank", "hamas", "hezbollah",
        "iran", "tehran", "saudi arabia", "riyadh", "uae", "dubai",
        "iraq", "baghdad", "syria", "damascus", "egypt", "cairo",
        "jordan", "lebanon", "beirut", "yemen", "qatar", "doha"
    ],
    "Australia": [
        "australia", "australian", "sydney", "melbourne", "brisbane",
        "canberra", "rba", "asx", "albanese"
    ],
    "Canada": [
        "canada", "canadian", "toronto", "ottawa", "montreal",
        "trudeau", "bank of canada", "tsx"
    ],
}

# ── Source → bias mapping ─────────────────────────────────────────────────────
SOURCE_BIAS: Dict[str, str] = {
    "BBC News":          "Center",
    "BBC World":         "Center",
    "BBC Technology":    "Center",
    "BBC Business":      "Center",
    "BBC Health":        "Center",
    "BBC Entertainment": "Center",
    "BBC Sport":         "Center",
    "Reuters":           "Center",
    "Reuters Business":  "Center",
    "Reuters Technology":"Center",
    "The Hindu":         "Center-Left",
    "The Hindu National":"Center-Left",
    "The Hindu Business":"Center",
    "The Hindu Sports":  "Center",
}


# ── Public API ────────────────────────────────────────────────────────────────

def classify_category(text: str) -> str:
    """Score each category by keyword hits; return highest scorer."""
    lower = text.lower()
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                scores[category] += 1

    best_cat = max(scores, key=lambda c: scores[c])
    return best_cat if scores[best_cat] > 0 else "World"


def detect_region(text: str, source: str, region_hint: str = "Global") -> str:
    """
    Score each region by keyword hits.
    Falls back to source-level hint when no keywords match.
    """
    lower = text.lower()
    scores: Dict[str, int] = {}

    for region, keywords in REGION_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count:
            scores[region] = count

    if scores:
        return max(scores, key=lambda r: scores[r])

    # Source-level heuristic
    if "Hindu" in source:
        return "India"

    return region_hint or "Global"


def get_source_bias(source: str) -> str:
    return SOURCE_BIAS.get(source, "Center")
