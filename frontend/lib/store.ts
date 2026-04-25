'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Article, User } from '@/types'

type UsageAnalytics = {
  sessions: number
  articlesRead: number
  shares: number
  bookmarksAdded: number
}

interface NewslyState {
  // ── Auth ──────────────────────────────────────────────────────────────────
  user: User | null
  token: string | null

  // ── Onboarding ────────────────────────────────────────────────────────────
  onboardingComplete: boolean

  // ── Preferences ───────────────────────────────────────────────────────────
  location: string
  categories: string[]

  // ── UI ────────────────────────────────────────────────────────────────────
  darkMode: boolean
  aiEnabled: boolean
  emailAlerts: boolean
  pushAlerts: boolean
  legalAccepted: boolean
  bookmarks: Article[]
  analytics: UsageAnalytics

  // ── Actions ───────────────────────────────────────────────────────────────
  setAuth: (user: User, token: string) => void
  logout: () => void
  setPreferences: (location: string, categories: string[]) => void
  completeOnboarding: () => void
  toggleDarkMode: () => void
  toggleAI: () => void
  setAlerts: (next: { emailAlerts?: boolean; pushAlerts?: boolean }) => void
  setLegalAccepted: (accepted: boolean) => void
  toggleBookmark: (article: Article) => void
  setBookmarks: (items: Article[]) => void
  isBookmarked: (articleId: string) => boolean
  trackArticleRead: () => void
  trackShare: () => void
  trackSession: () => void
}

export const useStore = create<NewslyState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      onboardingComplete: false,
      location: 'Global',
      categories: [],
      darkMode: false,
      aiEnabled: true,
      emailAlerts: false,
      pushAlerts: false,
      legalAccepted: false,
      bookmarks: [],
      analytics: {
        sessions: 0,
        articlesRead: 0,
        shares: 0,
        bookmarksAdded: 0,
      },

      setAuth: (user, token) => set({ user, token }),

      // FIX: reset darkMode to false AND remove the 'dark' class from <html>
      logout: () => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('dark')
        }
        set({
          user: null,
          token: null,
          onboardingComplete: false,
          categories: [],
          location: 'Global',
          darkMode: false,
          emailAlerts: false,
          pushAlerts: false,
          legalAccepted: false,
          bookmarks: [],
          analytics: {
            sessions: 0,
            articlesRead: 0,
            shares: 0,
            bookmarksAdded: 0,
          },
        })
      },

      setPreferences: (location, categories) => set({ location, categories }),

      completeOnboarding: () => set({ onboardingComplete: true }),

      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next)
          }
          return { darkMode: next }
        }),

      toggleAI: () => set((s) => ({ aiEnabled: !s.aiEnabled })),
      setAlerts: (next) =>
        set((s) => ({
          emailAlerts: next.emailAlerts ?? s.emailAlerts,
          pushAlerts: next.pushAlerts ?? s.pushAlerts,
        })),
      setLegalAccepted: (accepted) => set({ legalAccepted: accepted }),
      toggleBookmark: (article) =>
        set((s) => {
          const exists = s.bookmarks.some((a) => a.id === article.id)
          if (exists) {
            return { bookmarks: s.bookmarks.filter((a) => a.id !== article.id) }
          }
          return {
            bookmarks: [article, ...s.bookmarks].slice(0, 100),
            analytics: {
              ...s.analytics,
              bookmarksAdded: s.analytics.bookmarksAdded + 1,
            },
          }
        }),
      setBookmarks: (items) => set({ bookmarks: items }),
      isBookmarked: (articleId) =>
        get().bookmarks.some((a) => a.id === articleId),
      trackArticleRead: () =>
        set((s) => ({
          analytics: { ...s.analytics, articlesRead: s.analytics.articlesRead + 1 },
        })),
      trackShare: () =>
        set((s) => ({ analytics: { ...s.analytics, shares: s.analytics.shares + 1 } })),
      trackSession: () =>
        set((s) => ({ analytics: { ...s.analytics, sessions: s.analytics.sessions + 1 } })),
    }),
    {
      name: 'newsly-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
