export interface Article {
  id: string
  title: string
  description: string | null
  image_url: string | null
  source: string
  published_at: string
  article_url: string
  category: string
  region: string
  summary: string | null
  tone: 'Positive' | 'Neutral' | 'Negative' | null
  bias: string | null
  emotional_words: string[]
  highlight_title?: string | null
  highlight_description?: string | null
  read_time_minutes?: number
}

export interface NewsResponse {
  total: number
  page: number
  limit: number
  articles: Article[]
}

export interface User {
  id: string
  email: string
  username: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface UserPreferences {
  location: string
  categories: string[]
  email_alerts?: boolean
  push_alerts?: boolean
  digest_hour?: string
  legal_accepted?: boolean
}

export interface UserStats {
  articles_read: number
  shares: number
  bookmarks: number
  comments: number
}

export interface UserProfile {
  user_id: string
  email: string
  username: string
  full_name: string | null
  bio: string | null
  preferred_language: LanguageCode
  avatar_url: string | null
  stats: UserStats
  follows: string[]
}

export interface FollowItem {
  id: string
  follow_type: 'topic' | 'user'
  target: string
  created_at: string
}

export interface NotificationItem {
  id: string
  channel: 'email' | 'push'
  kind: string
  message: string
  status: string
  created_at: string
}

export interface CustomFeed {
  id: string
  url: string
  source_name: string
  region_hint: string
  is_active: boolean
  created_at: string
}

export interface DigestPreview {
  headline: string
  summary: string
  article_count: number
  articles: Article[]
}

export interface ArticleComment {
  id: string
  article_id: string
  user_id: string
  username: string
  body: string
  created_at: string
}

export interface PublisherControl {
  source: string
  is_blocked: boolean
  max_per_feed: number
  policy_status: string
}

export interface TakedownRequest {
  id: string
  source: string
  article_url: string
  reason: string
  requester_email: string
  status: string
}

export interface EditorPick {
  id: string
  article_id: string
  title: string
  source: string
  note: string | null
  rank: number
}

export type ToneType = 'Positive' | 'Neutral' | 'Negative'
export type LanguageCode = 'en' | 'hi'

export const CATEGORIES = [
  'Politics',
  'Technology',
  'Business',
  'World',
  'Health',
  'Sports',
  'Entertainment',
] as const

export const LOCATIONS = [
  { id: 'Global', label: 'Global', emoji: '🌍' },
  { id: 'India', label: 'India', emoji: '🇮🇳' },
  { id: 'US', label: 'United States', emoji: '🇺🇸' },
  { id: 'UK', label: 'United Kingdom', emoji: '🇬🇧' },
  { id: 'Europe', label: 'Europe', emoji: '🇪🇺' },
  { id: 'China', label: 'China', emoji: '🇨🇳' },
  { id: 'Middle East', label: 'Middle East', emoji: '🌐' },
  { id: 'Australia', label: 'Australia', emoji: '🇦🇺' },
  { id: 'Canada', label: 'Canada', emoji: '🇨🇦' },
] as const

export type Category = (typeof CATEGORIES)[number]
