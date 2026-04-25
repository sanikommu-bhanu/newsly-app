'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Moon,
  Sun,
  Bell,
  Mail,
  MapPin,
  Tag,
  Zap,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Check,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { savePreferences, sendTestNotification } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CATEGORIES, LOCATIONS } from '@/types'

import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType
  label: string
  description?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center justify-between py-4 px-5 bg-white dark:bg-dark-surface press-effect"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
          <Icon size={15} strokeWidth={1.8} className="text-muted dark:text-gray-400" />
        </div>
        <div className="text-left">
          <p className="text-[15px] font-sans font-medium text-ink dark:text-gray-100">{label}</p>
          {description && (
            <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {/* Toggle pill */}
      <div
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-gray-200 dark:bg-dark-border'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </div>
    </button>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-sans font-semibold text-muted dark:text-gray-500 uppercase tracking-widest px-5 pt-6 pb-2">
      {label}
    </p>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const {
    user,
    token,
    darkMode,
    aiEnabled,
    emailAlerts,
    pushAlerts,
    legalAccepted,
    location,
    categories,
    analytics,
    toggleDarkMode,
    toggleAI,
    setAlerts,
    setPreferences,
    logout,
  } = useStore()

  const [editingLocation, setEditingLocation] = useState(false)
  const [editingInterests, setEditingInterests] = useState(false)
  const [tempLocation, setTempLocation] = useState(location)
  const [tempCategories, setTempCategories] = useState<string[]>(categories)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) router.replace('/')
  }, [user, router])

  const handleSavePrefs = async () => {
    setSaving(true)
    setPreferences(tempLocation, tempCategories)
    if (token) {
      savePreferences({ location: tempLocation, categories: tempCategories }, token).catch(() => {})
    }
    setSaving(false)
    setEditingLocation(false)
    setEditingInterests(false)
  }

  const toggleTempCat = (cat: string) =>
    setTempCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )

  const handleLogout = () => {
    logout()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-28">
      <ThemeSync />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="px-5 pt-12 pb-6">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">
          Settings
        </h1>
      </header>

      {/* ── Profile card ─────────────────────────────────────────────── */}
      {user && (
        <div className="mx-4 mb-4 bg-white dark:bg-dark-surface rounded-2xl px-5 py-4 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent-light dark:bg-blue-950 flex items-center justify-center">
            <span className="font-display text-lg font-semibold text-accent">
              {(user.username || user.email)[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-sans font-semibold text-[15px] text-ink dark:text-gray-100">
              {user.username}
            </p>
            <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">
              {user.email}
            </p>
          </div>
        </div>
      )}

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <SectionLabel label="Appearance" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card divide-y divide-border dark:divide-dark-border">
        <ToggleRow
          icon={darkMode ? Moon : Sun}
          label="Dark Mode"
          description="Easy on the eyes at night"
          checked={darkMode}
          onChange={toggleDarkMode}
        />
      </div>

      {/* ── AI Features ──────────────────────────────────────────────── */}
      <SectionLabel label="AI Features" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card">
        <ToggleRow
          icon={Zap}
          label="AI Summaries & Insights"
          description="Tone, bias, emotional analysis"
          checked={aiEnabled}
          onChange={toggleAI}
        />
      </div>

      <SectionLabel label="Alerts" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card divide-y divide-border dark:divide-dark-border">
        <ToggleRow
          icon={Bell}
          label="Push Alerts"
          description="Get instant breaking-news notifications"
          checked={pushAlerts}
          onChange={() => {
            const next = !pushAlerts
            setAlerts({ pushAlerts: next })
            if (token) {
              void savePreferences(
                { location, categories, push_alerts: next, email_alerts: emailAlerts },
                token
              ).catch(() => {})
              if (next) {
                void sendTestNotification(token, {
                  channel: 'push',
                  message: 'Push alerts enabled for Newsly.',
                }).catch(() => {})
              }
            }
          }}
        />
        <ToggleRow
          icon={Mail}
          label="Email Digest"
          description="Receive a daily summary in your inbox"
          checked={emailAlerts}
          onChange={() => {
            const next = !emailAlerts
            setAlerts({ emailAlerts: next })
            if (token) {
              void savePreferences(
                { location, categories, email_alerts: next, push_alerts: pushAlerts },
                token
              ).catch(() => {})
              if (next) {
                void sendTestNotification(token, {
                  channel: 'email',
                  message: 'Email digest enabled for Newsly.',
                }).catch(() => {})
              }
            }
          }}
        />
      </div>

      {/* ── Personalisation ──────────────────────────────────────────── */}
      <SectionLabel label="Personalisation" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card divide-y divide-border dark:divide-dark-border">

        {/* Location row */}
        <div>
          <button
            onClick={() => { setEditingLocation((v) => !v); setTempLocation(location) }}
            className="w-full flex items-center justify-between py-4 px-5 press-effect"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
                <MapPin size={15} strokeWidth={1.8} className="text-muted dark:text-gray-400" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-sans font-medium text-ink dark:text-gray-100">Location</p>
                <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">{location}</p>
              </div>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={2}
              className={cn(
                'text-muted transition-transform duration-200',
                editingLocation && 'rotate-90'
              )}
            />
          </button>
          <AnimatePresence>
            {editingLocation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-2">
                  {LOCATIONS.map(({ id, label, emoji }) => (
                    <button
                      key={id}
                      onClick={() => setTempLocation(id)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                        tempLocation === id
                          ? 'bg-ink dark:bg-white border-ink dark:border-white'
                          : 'bg-gray-50 dark:bg-dark-bg border-border dark:border-dark-border'
                      )}
                    >
                      <span className={cn('text-sm font-sans font-medium flex items-center gap-2', tempLocation === id ? 'text-white dark:text-ink' : 'text-ink dark:text-gray-200')}>
                        <span>{emoji}</span> {label}
                      </span>
                      {tempLocation === id && <Check size={14} className="text-white dark:text-ink" />}
                    </button>
                  ))}
                  <button
                    onClick={handleSavePrefs}
                    disabled={saving}
                    className="w-full mt-1 py-2.5 bg-accent text-white text-sm font-sans font-semibold rounded-xl disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Interests row */}
        <div>
          <button
            onClick={() => { setEditingInterests((v) => !v); setTempCategories(categories) }}
            className="w-full flex items-center justify-between py-4 px-5 press-effect"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
                <Tag size={15} strokeWidth={1.8} className="text-muted dark:text-gray-400" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-sans font-medium text-ink dark:text-gray-100">Interests</p>
                <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">
                  {categories.length === 0
                    ? 'All topics'
                    : categories.slice(0, 3).join(', ') +
                      (categories.length > 3 ? ` +${categories.length - 3}` : '')}
                </p>
              </div>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={2}
              className={cn(
                'text-muted transition-transform duration-200',
                editingInterests && 'rotate-90'
              )}
            />
          </button>
          <AnimatePresence>
            {editingInterests && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {CATEGORIES.map((cat) => {
                      const isSelected = tempCategories.includes(cat)
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleTempCat(cat)}
                          className={cn(
                            'py-2.5 rounded-xl border text-sm font-sans font-medium transition-all press-effect',
                            isSelected
                              ? 'bg-ink dark:bg-white text-white dark:text-ink border-ink dark:border-white'
                              : 'bg-gray-50 dark:bg-dark-bg text-ink dark:text-gray-300 border-border dark:border-dark-border'
                          )}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleSavePrefs}
                    disabled={saving}
                    className="w-full py-2.5 bg-accent text-white text-sm font-sans font-semibold rounded-xl disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save Interests'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SectionLabel label="Insights" />
      <div className="mx-4 rounded-2xl border border-border bg-white px-5 py-4 shadow-card dark:border-dark-border dark:bg-dark-surface">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-dark-bg">
            <p className="font-display text-lg text-ink dark:text-white">{analytics.articlesRead}</p>
            <p className="text-[11px] font-sans text-muted dark:text-gray-500">Articles read</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-dark-bg">
            <p className="font-display text-lg text-ink dark:text-white">{analytics.bookmarksAdded}</p>
            <p className="text-[11px] font-sans text-muted dark:text-gray-500">Bookmarks added</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-dark-bg">
            <p className="font-display text-lg text-ink dark:text-white">{analytics.shares}</p>
            <p className="text-[11px] font-sans text-muted dark:text-gray-500">Shares</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-dark-bg">
            <p className="font-display text-lg text-ink dark:text-white">{analytics.sessions}</p>
            <p className="text-[11px] font-sans text-muted dark:text-gray-500">Sessions</p>
          </div>
        </div>
      </div>

      <SectionLabel label="Legal" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card">
        <Link href="/legal" className="w-full flex items-center justify-between py-4 px-5 press-effect">
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center">
              <ShieldCheck size={15} strokeWidth={1.8} className="text-muted dark:text-gray-400" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-sans font-medium text-ink dark:text-gray-100">Legal & Policy</p>
              <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">
                {legalAccepted ? 'Accepted' : 'Review required'}
              </p>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={2} className="text-muted" />
        </Link>
        <Link
          href="/admin/legal"
          className="w-full flex items-center justify-between border-t border-border py-4 px-5 press-effect dark:border-dark-border"
        >
          <div className="text-left">
            <p className="text-[15px] font-sans font-medium text-ink dark:text-gray-100">
              Publisher & Takedown Admin
            </p>
            <p className="text-xs font-sans text-muted dark:text-gray-500 mt-0.5">
              Source blocklist, limits, legal requests
            </p>
          </div>
          <ChevronRight size={16} strokeWidth={2} className="text-muted" />
        </Link>
      </div>

      {/* ── Account ──────────────────────────────────────────────────── */}
      <SectionLabel label="Account" />
      <div className="mx-4 bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3.5 px-5 py-4 press-effect"
        >
          <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center">
            <LogOut size={15} strokeWidth={1.8} className="text-rose-500" />
          </div>
          <span className="text-[15px] font-sans font-medium text-rose-500">Sign Out</span>
        </button>
      </div>

      <Footer className="mx-4 mt-8 border-0" />
      <BottomNav />
    </div>
  )
}
