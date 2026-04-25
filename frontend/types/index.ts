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

export type ToneType = 'Positive' | 'Neutral' | 'Negative'

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
] as const

export type Category = (typeof CATEGORIES)[number]
