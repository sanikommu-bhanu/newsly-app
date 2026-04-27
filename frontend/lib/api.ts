import type {
  Article,
  ArticleComment,
  AuthResponse,
  CustomFeed,
  DigestPreview,
  EditorPick,
  FollowItem,
  NewsResponse,
  NotificationItem,
  PublisherControl,
  TakedownRequest,
  UserProfile,
  UserPreferences,
} from '@/types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signup(
  email: string,
  username: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  })
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function socialGoogleLogin(idToken: string): Promise<AuthResponse> {
  return apiFetch('/auth/social/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  })
}

// ── News ──────────────────────────────────────────────────────────────────────

export async function fetchNews(params: {
  category?: string
  location?: string
  q?: string
  source?: string
  tone?: string
  bias?: string
  hours?: number
  page?: number
  limit?: number
  token?: string | null
  /** User's selected interest categories — used for client-side ranking */
  userCategories?: string[]
}): Promise<NewsResponse> {
  try {
    const q = new URLSearchParams()
    if (params.category && params.category !== 'All') q.set('category', params.category)
    if (params.location && params.location !== 'Global') q.set('location', params.location)
    if (params.q && params.q.trim()) q.set('q', params.q.trim())
    if (params.source && params.source.trim()) q.set('source', params.source.trim())
    if (params.tone && params.tone.trim()) q.set('tone', params.tone.trim())
    if (params.bias && params.bias.trim()) q.set('bias', params.bias.trim())
    if (params.hours && params.hours > 0) q.set('hours', String(params.hours))
    q.set('page', String(params.page ?? 1))
    q.set('limit', String(params.limit ?? 20))

    const result = await apiFetch<NewsResponse>(`/news?${q}`, {}, params.token)
    result.articles = dedupeArticles(result.articles)

    // Apply client-side ranking to live API results too
    if (params.userCategories || params.location) {
      result.articles = rankArticles(
        result.articles,
        params.userCategories ?? [],
        params.location ?? 'Global'
      )
    }

    return result
  } catch {
    // Graceful fallback to mock data when backend is unavailable
    return getMockNews(
      params.category,
      params.location,
      params.userCategories ?? [],
      params.page ?? 1,
      params.limit ?? 20
    )
  }
}

export async function fetchArticle(id: string): Promise<Article> {
  try {
    return await apiFetch<Article>(`/article/${id}`)
  } catch {
    const found = MOCK_ARTICLES.find((a) => a.id === id)
    if (!found) throw new Error('Article not found')
    return found
  }
}

export async function fetchTrending(limit = 8): Promise<Article[]> {
  try {
    return await apiFetch<Article[]>(`/news/trending?limit=${limit}`)
  } catch {
    return MOCK_ARTICLES.slice(0, limit)
  }
}

export async function fetchEditorPicks(): Promise<Article[]> {
  try {
    return await apiFetch<Article[]>('/news/editor-picks')
  } catch {
    return []
  }
}

export async function fetchRecommendations(token: string, limit = 10): Promise<Article[]> {
  return apiFetch<Article[]>(`/news/recommendations?limit=${limit}`, {}, token)
}

export async function fetchRelated(articleId: string, limit = 3): Promise<Article[]> {
  return apiFetch<Article[]>(`/news/${articleId}/related?limit=${limit}`)
}

export async function fetchComments(articleId: string): Promise<ArticleComment[]> {
  return apiFetch<ArticleComment[]>(`/article/${articleId}/comments`)
}

export async function postComment(
  articleId: string,
  body: string,
  token: string
): Promise<ArticleComment> {
  return apiFetch<ArticleComment>(
    `/article/${articleId}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
    token
  )
}

export async function savePreferences(
  prefs: UserPreferences,
  token: string
): Promise<void> {
  await apiFetch('/user/preferences', {
    method: 'POST',
    body: JSON.stringify(prefs),
  }, token)
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  return apiFetch<UserProfile>('/user/profile', {}, token)
}

export async function updateProfile(
  token: string,
  payload: Partial<{
    full_name: string
    bio: string
    preferred_language: 'en' | 'hi'
    avatar_url: string
  }>
): Promise<UserProfile> {
  return apiFetch<UserProfile>(
    '/user/profile',
    { method: 'PATCH', body: JSON.stringify(payload) },
    token
  )
}

export async function changePassword(
  token: string,
  payload: { current_password: string; new_password: string }
): Promise<void> {
  await apiFetch('/user/change-password', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export async function deleteAccount(token: string): Promise<void> {
  await apiFetch('/user/account', { method: 'DELETE', body: JSON.stringify({ confirm_text: 'DELETE' }) }, token)
}

export async function fetchFollows(token: string): Promise<FollowItem[]> {
  return apiFetch<FollowItem[]>('/user/follows', {}, token)
}

export async function followTopic(token: string, target: string): Promise<void> {
  await apiFetch('/user/follows', { method: 'POST', body: JSON.stringify({ follow_type: 'topic', target }) }, token)
}

export async function unfollowTopic(token: string, target: string): Promise<void> {
  await apiFetch(`/user/follows?follow_type=topic&target=${encodeURIComponent(target)}`, { method: 'DELETE' }, token)
}

export async function fetchBookmarks(token: string): Promise<Article[]> {
  const rows = await apiFetch<
    Array<{
      article_id: string
      title: string
      article_url: string
      source: string
      image_url: string | null
      category: string | null
      region: string | null
      published_at: string | null
    }>
  >('/user/bookmarks', {}, token)
  return rows.map((row) => ({
    id: row.article_id,
    title: row.title,
    article_url: row.article_url,
    source: row.source,
    image_url: row.image_url,
    category: row.category ?? 'World',
    region: row.region ?? 'Global',
    published_at: row.published_at ?? new Date().toISOString(),
    description: null,
    summary: null,
    tone: null,
    bias: null,
    emotional_words: [],
  }))
}

export async function upsertBookmark(article: Article, token: string): Promise<void> {
  await apiFetch(
    '/user/bookmarks',
    {
      method: 'POST',
      body: JSON.stringify({
        article_id: article.id,
        title: article.title,
        article_url: article.article_url,
        source: article.source,
        image_url: article.image_url,
        category: article.category,
        region: article.region,
        published_at: article.published_at,
      }),
    },
    token
  )
}

export async function removeBookmark(articleId: string, token: string): Promise<void> {
  await apiFetch(`/user/bookmarks/${articleId}`, { method: 'DELETE' }, token)
}

export async function trackInteraction(
  token: string,
  payload: { article_id: string; action: 'read' | 'share' | 'bookmark' | 'comment'; category?: string; source?: string }
): Promise<void> {
  await apiFetch(
    '/user/interactions',
    { method: 'POST', body: JSON.stringify(payload) },
    token
  )
}

export async function sendTestNotification(
  token: string,
  payload: { channel: 'email' | 'push'; message: string }
): Promise<void> {
  await apiFetch('/user/notifications/test', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export async function fetchNotifications(token: string): Promise<NotificationItem[]> {
  return apiFetch<NotificationItem[]>('/user/notifications?limit=30', {}, token)
}

export async function fetchDigestPreview(token: string): Promise<DigestPreview> {
  return apiFetch<DigestPreview>('/user/newsletter/digest', {}, token)
}

export async function fetchCustomFeeds(token: string): Promise<CustomFeed[]> {
  return apiFetch<CustomFeed[]>('/user/custom-feeds', {}, token)
}

export async function addCustomFeed(
  token: string,
  payload: { url: string; source_name: string; region_hint?: string }
): Promise<void> {
  await apiFetch('/user/custom-feeds', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export async function removeCustomFeed(token: string, id: string): Promise<void> {
  await apiFetch(`/user/custom-feeds/${id}`, { method: 'DELETE' }, token)
}

export function getBookmarkExportUrl(): string {
  return `${API}/user/bookmarks/export`
}

export async function fetchPublisherControls(token: string): Promise<PublisherControl[]> {
  return apiFetch('/admin/publishers', {}, token)
}

export async function upsertPublisherControl(
  token: string,
  payload: PublisherControl
): Promise<void> {
  await apiFetch('/admin/publishers', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export async function fetchTakedowns(token: string): Promise<TakedownRequest[]> {
  return apiFetch('/admin/takedowns', {}, token)
}

export async function fetchAdminEditorPicks(token: string): Promise<EditorPick[]> {
  return apiFetch<EditorPick[]>('/admin/editor-picks', {}, token)
}

export async function upsertAdminEditorPick(
  token: string,
  payload: { article_id: string; title: string; source: string; note?: string; rank?: number }
): Promise<void> {
  await apiFetch('/admin/editor-picks', { method: 'POST', body: JSON.stringify(payload) }, token)
}

export async function deleteAdminEditorPick(token: string, id: string): Promise<void> {
  await apiFetch(`/admin/editor-picks/${id}`, { method: 'DELETE' }, token)
}

export async function createTakedown(
  payload: { source: string; article_url: string; reason: string; requester_email: string }
): Promise<void> {
  await apiFetch('/admin/takedowns', { method: 'POST', body: JSON.stringify(payload) })
}

export async function resolveTakedown(token: string, id: string): Promise<void> {
  await apiFetch(`/admin/takedowns/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status: 'resolved' }) }, token)
}

// ── Mock data ─────────────────────────────────────────────────────────────────

function ago(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString()
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: 'tech-001',
    title: "India's ISRO Sets a New World Record with 36-Satellite Single Launch",
    description:
      "The Indian Space Research Organisation has successfully placed 36 OneWeb broadband satellites into low-earth orbit aboard a single PSLV-XL rocket, marking a historic achievement for the nation's space program.",
    image_url:
      'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=900&auto=format&fit=crop',
    source: 'The Hindu',
    published_at: ago(1),
    article_url: 'https://www.thehindu.com',
    category: 'Technology',
    region: 'India',
    summary:
      "ISRO's PSLV-C58 successfully deployed 36 OneWeb satellites, setting a national record for the most satellites launched in a single mission. The achievement significantly boosts India's standing in the global commercial launch market. Each satellite weighs approximately 150 kg and will provide broadband coverage across underserved regions.",
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['achievement', 'historic', 'record', 'breakthrough'],
  },
  {
    id: 'world-001',
    title: 'UN Security Council Calls Emergency Meeting Over Gaza Ceasefire Talks',
    description:
      'World leaders gathered at the United Nations Security Council for an emergency session to negotiate a sustainable ceasefire framework, as humanitarian conditions in the region continue to deteriorate.',
    image_url:
      'https://images.unsplash.com/photo-1526958977630-b4fcd9f9898b?w=900&auto=format&fit=crop',
    source: 'BBC World',
    published_at: ago(2),
    article_url: 'https://www.bbc.com/news/world',
    category: 'World',
    region: 'Global',
    summary:
      'The UN Security Council convened an emergency session after diplomatic efforts by Egypt and Qatar showed renewed progress on a ceasefire agreement. Key sticking points remain around aid corridor access and a prisoner exchange framework. The talks represent the most significant diplomatic progress in several months.',
    tone: 'Neutral',
    bias: 'Center',
    emotional_words: ['emergency', 'ceasefire', 'humanitarian', 'crisis'],
  },
  {
    id: 'biz-001',
    title: 'Federal Reserve Holds Rates Steady; Signals Two Cuts Possible in 2025',
    description:
      'The Federal Open Market Committee voted unanimously to keep the benchmark interest rate at its current level, while Chair Powell hinted at the possibility of two quarter-point reductions later this year if inflation data continues to cool.',
    image_url:
      'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&auto=format&fit=crop',
    source: 'Reuters Business',
    published_at: ago(3),
    article_url: 'https://www.reuters.com',
    category: 'Business',
    region: 'US',
    summary:
      "The Fed's decision to hold rates was widely anticipated by markets, though the dovish guidance surprised analysts who had priced in only one cut. Bond yields fell sharply following Powell's remarks, while the S&P 500 climbed 0.8% to a fresh record. Inflation has eased to 2.4%, approaching the Fed's 2% target.",
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['signals', 'possible', 'cool', 'record'],
  },
  {
    id: 'politics-001',
    title: 'UK Prime Minister Announces Snap General Election for July',
    description:
      'In a surprise address from Downing Street, the Prime Minister called for a general election, citing a need for a fresh public mandate ahead of major economic reforms and ongoing post-Brexit trade negotiations.',
    image_url:
      'https://images.unsplash.com/photo-1529107386315-e1a2ef112a72?w=900&auto=format&fit=crop',
    source: 'BBC News',
    published_at: ago(4),
    article_url: 'https://www.bbc.com/news/politics',
    category: 'Politics',
    region: 'UK',
    summary:
      'The snap election announcement sent shockwaves through Westminster, with opposition parties welcoming the opportunity while government backbenchers expressed concern about poll numbers. Polling averages show the ruling party trailing by 8 points. Campaign period begins immediately, with polling day set for the third week of July.',
    tone: 'Neutral',
    bias: 'Center',
    emotional_words: ['surprise', 'shock', 'reform', 'mandate'],
  },
  {
    id: 'health-001',
    title: 'WHO Approves First Malaria Vaccine for Broad Distribution Across Africa',
    description:
      'The World Health Organization has granted full approval to the RTS,S/AS01 vaccine for mass distribution across Sub-Saharan Africa, a development researchers describe as a generational breakthrough in public health.',
    image_url:
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&auto=format&fit=crop',
    source: 'BBC Health',
    published_at: ago(5),
    article_url: 'https://www.bbc.com/news/health',
    category: 'Health',
    region: 'Global',
    summary:
      "The vaccine, developed over 30 years, demonstrated 56% efficacy in Phase 3 trials and has already prevented thousands of deaths in pilot programs. The WHO approval unlocks UNICEF procurement channels for 28 eligible countries. Distribution is expected to reach 15 million children in the first year alone.",
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['breakthrough', 'hope', 'prevention', 'approval'],
  },
  {
    id: 'sports-001',
    title: 'India Beat Australia by 6 Wickets to Clinch Test Series 3-1',
    description:
      'Rohit Sharma led India to a commanding victory at the Sydney Cricket Ground, completing a dominant series win over Australia on home soil with a match to spare.',
    image_url:
      'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&auto=format&fit=crop',
    source: 'The Hindu Sports',
    published_at: ago(6),
    article_url: 'https://www.thehindu.com/sport',
    category: 'Sports',
    region: 'India',
    summary:
      "India's seamers were dominant throughout the series, with Jasprit Bumrah claiming 28 wickets across four Tests. Virat Kohli returned to form with back-to-back centuries in the final Test. The victory propels India to the top of the ICC World Test Championship table with 68.5 PCT points.",
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['dominant', 'victory', 'triumph', 'win'],
  },
  {
    id: 'tech-002',
    title: 'OpenAI Releases GPT-5 with Native Multimodal Reasoning Capabilities',
    description:
      "OpenAI's latest flagship model demonstrates significantly improved performance on scientific reasoning benchmarks while introducing native video understanding and real-time voice interaction.",
    image_url:
      'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=900&auto=format&fit=crop',
    source: 'BBC Technology',
    published_at: ago(7),
    article_url: 'https://www.bbc.com/news/technology',
    category: 'Technology',
    region: 'US',
    summary:
      'GPT-5 scores 92% on the MMLU benchmark, outperforming human experts in domains including medicine, law, and advanced mathematics. The model introduces a new "extended thinking" mode for complex problem-solving. Pricing remains unchanged from GPT-4 Turbo, making it accessible to existing subscribers.',
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['innovation', 'breakthrough', 'advanced', 'outperforming'],
  },
  {
    id: 'entertainment-001',
    title: "Netflix's Thriller Series \"Dark Waters\" Becomes Most-Watched Show of 2025",
    description:
      'The Indian-British co-production has accumulated over 180 million viewing hours in its first two weeks, marking a new milestone for international content on the platform.',
    image_url:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=900&auto=format&fit=crop',
    source: 'BBC Entertainment',
    published_at: ago(9),
    article_url: 'https://www.bbc.com/culture',
    category: 'Entertainment',
    region: 'India',
    summary:
      "The show's success validates Netflix's strategy of co-producing premium international content with local creative teams. Director Anurag Kashyap called the viewership numbers \"humbling and unexpected.\" A second season has been greenlit with an expanded production budget of $40 million.",
    tone: 'Positive',
    bias: 'Center',
    emotional_words: ['milestone', 'success', 'triumph', 'record'],
  },
  {
    id: 'biz-002',
    title: "Adani Group Secures $2.4 Billion Deal to Develop Kenya's Largest Airport",
    description:
      'The Indian conglomerate has signed a 30-year public-private partnership agreement with the Kenyan government to redevelop and operate Jomo Kenyatta International Airport in Nairobi.',
    image_url:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&auto=format&fit=crop',
    source: 'The Hindu Business',
    published_at: ago(11),
    article_url: 'https://www.thehindu.com/business',
    category: 'Business',
    region: 'India',
    summary:
      "The deal represents one of the largest foreign direct investments in East African infrastructure in the past decade. Adani Airports will fund a new terminal capable of handling 25 million passengers annually. The agreement is subject to Kenyan parliamentary approval expected in the next 60 days.",
    tone: 'Neutral',
    bias: 'Center',
    emotional_words: ['deal', 'growth', 'expansion', 'investment'],
  },
  {
    id: 'world-002',
    title: 'China Reports Slowest Economic Growth in 35 Years at 3.8 Percent',
    description:
      "China's National Bureau of Statistics released data showing GDP growth fell to 3.8% in the previous fiscal year, its weakest pace since 1989, driven by a prolonged property sector crisis and weak domestic consumption.",
    image_url:
      'https://images.unsplash.com/photo-1474403078171-7f199e9d1335?w=900&auto=format&fit=crop',
    source: 'Reuters',
    published_at: ago(13),
    article_url: 'https://www.reuters.com',
    category: 'Business',
    region: 'China',
    summary:
      "The slowdown has intensified pressure on Beijing to deploy large-scale fiscal stimulus, with economists calling for at least ¥3 trillion in bond issuance. Youth unemployment hit a record 21.3% last quarter. Global markets reacted cautiously, with commodity prices falling on reduced demand forecasts.",
    tone: 'Negative',
    bias: 'Center',
    emotional_words: ['slowdown', 'crisis', 'pressure', 'decline'],
  },
]

// ── Smart feed ranking ────────────────────────────────────────────────────────
// Simple scoring — no ML, just three lightweight signals:
//   +2  if article category matches a user-selected interest
//   +2  if article region matches the user's chosen location
//   +1  if published within the last 6 hours (recency bonus)
//
// Higher score = appears earlier in the feed.

function scoreArticle(
  article: Article,
  userCategories: string[],
  userLocation: string
): number {
  let score = 0

  // Category interest match
  if (userCategories.length > 0 && userCategories.includes(article.category)) {
    score += 2
  }

  // Location match (skip Global — it's the default "no preference")
  if (userLocation && userLocation !== 'Global' && article.region === userLocation) {
    score += 2
  }

  // Recency — articles published within the last 6 hours get a small boost
  const hoursOld =
    (Date.now() - new Date(article.published_at).getTime()) / 3_600_000
  if (hoursOld < 6) {
    score += 1
  }

  return score
}

/**
 * Re-rank an array of articles using the user's interests and location.
 * Stable sort — articles with the same score keep their original order.
 * Exported so the home page can apply ranking to live API results too.
 */
export function rankArticles(
  articles: Article[],
  userCategories: string[],
  userLocation: string
): Article[] {
  return [...articles].sort(
    (a, b) =>
      scoreArticle(b, userCategories, userLocation) -
      scoreArticle(a, userCategories, userLocation)
  )
}

function getMockNews(
  category?: string,
  location?: string,
  userCategories: string[] = [],
  page = 1,
  limit = 20
): NewsResponse {
  let articles = [...MOCK_ARTICLES]

  // Category filter
  if (category && category !== 'All') {
    articles = articles.filter(
      (a) => a.category.toLowerCase() === category.toLowerCase()
    )
  }

  // Rank by user interests + location + recency
  articles = rankArticles(dedupeArticles(articles), userCategories, location ?? 'Global')

  const start = (page - 1) * limit
  return {
    total: articles.length,
    page,
    limit,
    articles: articles.slice(start, start + limit),
  }
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>()
  const out: Article[] = []
  for (const article of articles) {
    const key = article.article_url?.trim() || `${article.title}|${article.source}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(article)
  }
  return out
}
