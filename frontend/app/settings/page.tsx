'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Globe, LogOut, Mail, Moon, Plus, Sun, Trash2, Zap } from 'lucide-react'
import {
  addCustomFeed,
  fetchCustomFeeds,
  fetchDigestPreview,
  fetchNotifications,
  removeCustomFeed,
  savePreferences,
  sendTestNotification,
  updateProfile,
} from '@/lib/api'
import { t } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { type CustomFeed, type DigestPreview, type NotificationItem } from '@/types'
import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export default function SettingsPage() {
  const router = useRouter()
  const {
    user,
    token,
    darkMode,
    aiEnabled,
    emailAlerts,
    pushAlerts,
    location,
    categories,
    language,
    toggleDarkMode,
    toggleAI,
    setAlerts,
    setLanguage,
    logout,
  } = useStore()

  const [digest, setDigest] = useState<DigestPreview | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([])
  const [feedUrl, setFeedUrl] = useState('')
  const [feedName, setFeedName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) router.replace('/')
  }, [user, router])

  useEffect(() => {
    if (!token) return
    fetchDigestPreview(token).then(setDigest).catch(() => setDigest(null))
    fetchNotifications(token).then(setNotifications).catch(() => setNotifications([]))
    fetchCustomFeeds(token).then(setCustomFeeds).catch(() => setCustomFeeds([]))
  }, [token])

  const handleLogout = () => {
    logout()
    router.replace('/')
  }

  const handlePushToggle = async () => {
    const next = !pushAlerts
    if (next && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      new Notification('Newsly push alerts enabled')
    }
    setAlerts({ pushAlerts: next })
    if (token) {
      await savePreferences(
        { location, categories, push_alerts: next, email_alerts: emailAlerts },
        token
      )
      if (next) {
        await sendTestNotification(token, {
          channel: 'push',
          message: 'Push alerts enabled for Newsly.',
        })
      }
    }
  }

  const handleEmailToggle = async () => {
    const next = !emailAlerts
    setAlerts({ emailAlerts: next })
    if (token) {
      await savePreferences(
        { location, categories, email_alerts: next, push_alerts: pushAlerts },
        token
      )
      if (next) {
        await sendTestNotification(token, {
          channel: 'email',
          message: 'Email digest enabled for Newsly.',
        })
      }
    }
  }

  const onLanguageChange = async (next: 'en' | 'hi') => {
    setLanguage(next)
    if (token) {
      await updateProfile(token, { preferred_language: next })
    }
  }

  const onAddCustomFeed = async () => {
    if (!token || !feedUrl.trim() || !feedName.trim()) return
    setSaving(true)
    try {
      await addCustomFeed(token, {
        url: feedUrl.trim(),
        source_name: feedName.trim(),
        region_hint: location,
      })
      const refreshed = await fetchCustomFeeds(token)
      setCustomFeeds(refreshed)
      setFeedUrl('')
      setFeedName('')
    } finally {
      setSaving(false)
    }
  }

  const onRemoveCustomFeed = async (id: string) => {
    if (!token) return
    await removeCustomFeed(token, id)
    setCustomFeeds((prev) => prev.filter((f) => f.id !== id))
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-28">
      <ThemeSync />
      <header className="px-5 pt-12 pb-6">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">
          {t(language, 'settings')}
        </h1>
      </header>

      <main className="space-y-4 px-4">
        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            Account
          </p>
          <Link href="/profile" className="text-sm font-semibold text-accent">
            Open profile
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            Appearance & AI
          </p>
          <div className="space-y-2 text-sm">
            <button
              onClick={toggleDarkMode}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-dark-border"
            >
              <span className="inline-flex items-center gap-2">
                {darkMode ? <Moon size={14} /> : <Sun size={14} />} Dark mode
              </span>
              <span>{darkMode ? 'On' : 'Off'}</span>
            </button>
            <button
              onClick={toggleAI}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-dark-border"
            >
              <span className="inline-flex items-center gap-2">
                <Zap size={14} /> AI insights
              </span>
              <span>{aiEnabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            Notifications
          </p>
          <div className="space-y-2 text-sm">
            <button
              onClick={handlePushToggle}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-dark-border"
            >
              <span className="inline-flex items-center gap-2">
                <Bell size={14} /> Push alerts
              </span>
              <span>{pushAlerts ? 'On' : 'Off'}</span>
            </button>
            <button
              onClick={handleEmailToggle}
              className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-dark-border"
            >
              <span className="inline-flex items-center gap-2">
                <Mail size={14} /> Email digest
              </span>
              <span>{emailAlerts ? 'On' : 'Off'}</span>
            </button>
          </div>
          {notifications.length > 0 && (
            <div className="mt-3 space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-border px-3 py-2 text-xs dark:border-dark-border"
                >
                  <p className="font-semibold">{n.kind}</p>
                  <p className="text-muted dark:text-gray-400">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            {t(language, 'newsletter')}
          </p>
          {digest ? (
            <div className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border">
              <p className="font-semibold">{digest.headline}</p>
              <p className="mt-1 text-muted dark:text-gray-400">{digest.summary}</p>
              <p className="mt-1 text-xs">{digest.article_count} stories</p>
            </div>
          ) : (
            <p className="text-sm text-muted dark:text-gray-400">Digest preview unavailable.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            {t(language, 'customRss')}
          </p>
          <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Source name"
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
            />
            <input
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
            />
          </div>
          <button
            onClick={onAddCustomFeed}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold dark:border-dark-border"
          >
            <Plus size={12} /> Add feed
          </button>
          <div className="mt-3 space-y-2">
            {customFeeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{feed.source_name}</p>
                  <p className="truncate text-xs text-muted dark:text-gray-400">{feed.url}</p>
                </div>
                <button
                  onClick={() => onRemoveCustomFeed(feed.id)}
                  className="rounded-full p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
            <span className="inline-flex items-center gap-2">
              <Globe size={12} /> {t(language, 'language')}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onLanguageChange('en')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                language === 'en'
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                  : 'border-border dark:border-dark-border'
              }`}
            >
              English
            </button>
            <button
              onClick={() => onLanguageChange('hi')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                language === 'hi'
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                  : 'border-border dark:border-dark-border'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </section>

        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <LogOut size={14} /> Sign out
        </button>
      </main>

      <Footer className="mx-4 mt-8 border-0" />
      <BottomNav />
    </div>
  )
}
