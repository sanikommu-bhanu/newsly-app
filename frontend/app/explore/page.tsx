'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { fetchNews } from '@/lib/api'
import { cn, getCategoryColor } from '@/lib/utils'
import type { Article } from '@/types'
import { CATEGORIES, LOCATIONS } from '@/types'

import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import ArticleCard from '@/components/ArticleCard'
import { SkeletonList } from '@/components/SkeletonCard'
import EmptyState from '@/components/EmptyState'
import Footer from '@/components/Footer'

const CATEGORY_ICONS: Record<string, string> = {
  Politics: '🏛️',
  Technology: '💡',
  Business: '📈',
  World: '🌍',
  Health: '🩺',
  Sports: '⚽',
  Entertainment: '🎬',
}

export default function ExplorePage() {
  const router = useRouter()
  const { user, token, language } = useStore()

  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [tone, setTone] = useState<string | null>(null)
  const [bias, setBias] = useState<string | null>(null)
  const [hours, setHours] = useState<number | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (!user) router.replace('/')
  }, [user, router])

  const load = useCallback(async (cat?: string, region?: string, search?: string) => {
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetchNews({
        category: cat || undefined,
        location: region || undefined,
        q: search || undefined,
        source: source || undefined,
        tone: tone || undefined,
        bias: bias || undefined,
        hours: hours ?? undefined,
        page: 1,
        limit: 15,
        token,
      })
      setArticles(res.articles)
    } catch {
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [token, source, tone, bias, hours])

  const handleCatSelect = (cat: string) => {
    const next = selectedCat === cat ? null : cat
    setSelectedCat(next)
    load(next || undefined, selectedRegion || undefined, query)
  }

  const handleRegionSelect = (region: string) => {
    const next = selectedRegion === region ? null : region
    setSelectedRegion(next)
    load(selectedCat || undefined, next || undefined, query)
  }

  const clearFilters = () => {
    setSelectedCat(null)
    setSelectedRegion(null)
    setQuery('')
    setSource('')
    setTone(null)
    setBias(null)
    setHours(null)
    setArticles([])
    setSearched(false)
  }

  useEffect(() => {
    if (!selectedCat && !selectedRegion && !query.trim()) return
    const t = setTimeout(() => {
      load(selectedCat || undefined, selectedRegion || undefined, query.trim() || undefined)
    }, 240)
    return () => clearTimeout(t)
  }, [query, selectedCat, selectedRegion, source, tone, bias, hours, load])

  const hasFilters = selectedCat || selectedRegion

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-24">
      <ThemeSync />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 dark:bg-dark-bg/90 backdrop-blur-md px-5 pt-12 pb-4">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white mb-4">
          {t(language, 'explore')}
        </h1>

        {/* Search bar */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            strokeWidth={2}
          />
          <input
            type="search"
            placeholder="Search in results…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl pl-9 pr-4 py-2.5 text-sm font-sans text-ink dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-muted"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Source (BBC, Reuters...)"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-xl border border-border bg-white px-3 py-2 text-xs dark:border-dark-border dark:bg-dark-surface"
          />
          <select
            value={hours ?? ''}
            onChange={(e) => setHours(e.target.value ? Number(e.target.value) : null)}
            className="rounded-xl border border-border bg-white px-3 py-2 text-xs dark:border-dark-border dark:bg-dark-surface"
          >
            <option value="">Any time</option>
            <option value="6">Last 6h</option>
            <option value="24">Last 24h</option>
            <option value="72">Last 3 days</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {['Positive', 'Neutral', 'Negative'].map((value) => (
            <button
              key={value}
              onClick={() => setTone((prev) => (prev === value ? null : value))}
              className={cn(
                'rounded-full border px-2 py-1',
                tone === value
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                  : 'border-border dark:border-dark-border'
              )}
            >
              Tone: {value}
            </button>
          ))}
          {['Center', 'Center-Left', 'Center-Right', 'Left', 'Right'].map((value) => (
            <button
              key={value}
              onClick={() => setBias((prev) => (prev === value ? null : value))}
              className={cn(
                'rounded-full border px-2 py-1',
                bias === value
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                  : 'border-border dark:border-dark-border'
              )}
            >
              Bias: {value}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4">
        {/* ── Category grid ───────────────────────────────────────────── */}
        <section className="mb-5">
          <p className="text-xs font-sans font-semibold text-muted dark:text-gray-500 uppercase tracking-wide mb-3 px-1">
            Categories
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCat === cat
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleCatSelect(cat)}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-200 text-left',
                    isActive
                      ? 'bg-ink dark:bg-white border-ink dark:border-white'
                      : 'bg-white dark:bg-dark-surface border-border dark:border-dark-border shadow-card'
                  )}
                >
                  <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                  <span
                    className={cn(
                      'font-sans font-medium text-sm',
                      isActive ? 'text-white dark:text-ink' : 'text-ink dark:text-gray-200'
                    )}
                  >
                    {cat}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* ── Region filter ────────────────────────────────────────────── */}
        <section className="mb-5">
          <p className="text-xs font-sans font-semibold text-muted dark:text-gray-500 uppercase tracking-wide mb-3 px-1">
            Region
          </p>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map(({ id, label, emoji }) => {
              const isActive = selectedRegion === id
              return (
                <button
                  key={id}
                  onClick={() => handleRegionSelect(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-sans font-medium transition-all duration-200 press-effect',
                    isActive
                      ? 'bg-ink dark:bg-white text-white dark:text-ink border-ink dark:border-white'
                      : 'bg-white dark:bg-dark-surface text-ink dark:text-gray-300 border-border dark:border-dark-border shadow-card'
                  )}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Clear filters ─────────────────────────────────────────────── */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-sans font-medium text-muted dark:text-gray-500 hover:text-accent dark:hover:text-accent mb-4 press-effect"
          >
            <X size={12} />
            Clear filters
          </button>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {loading ? (
          <SkeletonList count={3} />
        ) : searched && articles.length === 0 ? (
          <EmptyState
            message="No articles match your filter. Try a different category or region."
            action={{ label: 'Clear all', onClick: clearFilters }}
          />
        ) : searched ? (
          <>
            <p className="text-xs font-sans text-muted dark:text-gray-500 mb-3 px-1">
              {articles.length} article{articles.length !== 1 ? 's' : ''}
              {selectedCat && ` in ${selectedCat}`}
              {selectedRegion && ` · ${selectedRegion}`}
            </p>
            <div className="space-y-4">
              {articles.map((article, i) => (
                <ArticleCard key={article.id} article={article} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm font-sans text-muted dark:text-gray-500">
              Select a category or region above to explore
            </p>
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
