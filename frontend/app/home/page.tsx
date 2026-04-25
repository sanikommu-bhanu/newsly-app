'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { RefreshCw, MapPin } from 'lucide-react'
import { useStore } from '@/lib/store'
import { fetchNews } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Article } from '@/types'

import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import CategoryTabs from '@/components/CategoryTabs'
import ArticleCard from '@/components/ArticleCard'
import { SkeletonList } from '@/components/SkeletonCard'
import EmptyState from '@/components/EmptyState'
import Footer from '@/components/Footer'
import NewslyLogo from '@/components/NewslyLogo'

export default function HomePage() {
  const router = useRouter()
  const { user, token, location, categories, onboardingComplete } = useStore()

  const [activeCategory, setActiveCategory] = useState('All')
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  // Track whether error was a network/API failure vs just empty results
  const [errorType, setErrorType] = useState<'error' | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Auth guard — small delay to let Zustand hydrate from localStorage
  useEffect(() => {
    const t = setTimeout(() => {
      if (!user) router.replace('/')
      else if (!onboardingComplete) router.replace('/onboarding')
    }, 80)
    return () => clearTimeout(t)
  }, [user, onboardingComplete, router])

  const load = useCallback(
    async (cat: string, pg: number, reset: boolean) => {
      if (pg === 1) setLoading(true)
      else setLoadingMore(true)
      setErrorType(null)

      try {
        const res = await fetchNews({
          category: cat === 'All' ? undefined : cat,
          location: location !== 'Global' ? location : undefined,
          page: pg,
          limit: 10,
          token,
          // Pass user categories so the ranking function can prioritise them
          userCategories: categories,
        })

        setTotal(res.total)
        if (reset || pg === 1) {
          setArticles(res.articles)
        } else {
          setArticles((prev) => [...prev, ...res.articles])
        }
      } catch {
        setErrorType('error')
      } finally {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
        setRetrying(false)
      }
    },
    [location, token, categories]
  )

  // Load on category change
  useEffect(() => {
    setPage(1)
    load(activeCategory, 1, true)
  }, [activeCategory, load])

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore && articles.length < total) {
          const nextPage = page + 1
          setPage(nextPage)
          load(activeCategory, nextPage, false)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadingMore, articles.length, total, page, activeCategory, load])

  const handleRefresh = () => {
    setRefreshing(true)
    setPage(1)
    load(activeCategory, 1, true)
  }

  const handleRetry = () => {
    setRetrying(true)
    setPage(1)
    load(activeCategory, 1, true)
  }

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-24">
      <ThemeSync />

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 dark:bg-dark-bg/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 pt-12 pb-3">
          <div>
            <NewslyLogo size="sm" showWordmark />
            {location !== 'Global' && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin size={10} className="text-accent" />
                <span className="text-[11px] font-sans text-muted dark:text-gray-500">
                  {location}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            aria-label="Refresh feed"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-dark-surface shadow-card press-effect disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              strokeWidth={2}
              className={cn(
                'text-muted dark:text-gray-400',
                refreshing && 'animate-spin'
              )}
            />
          </button>
        </div>

        {/* Category tabs */}
        <div className="pb-2">
          <CategoryTabs active={activeCategory} onChange={handleCategoryChange} />
        </div>
      </header>

      {/* ── Personalisation banner ──────────────────────────────────────── */}
      {categories.length > 0 && activeCategory === 'All' && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-4 mt-3 mb-1 px-4 py-2.5 bg-accent-light dark:bg-blue-950/40 rounded-xl flex items-center gap-2"
        >
          <span className="text-accent text-xs leading-none">✦</span>
          <p className="text-xs font-sans text-accent dark:text-blue-300">
            Ranked for you ·{' '}
            {categories.slice(0, 3).join(', ')}
            {categories.length > 3 && ` +${categories.length - 3} more`}
          </p>
        </motion.div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="px-4 pt-3">
        {loading ? (
          // Always show skeletons — never a blank screen
          <SkeletonList count={4} />
        ) : errorType === 'error' ? (
          // Network / API failure with retry
          <EmptyState
            variant="error"
            action={{ label: 'Try Again', onClick: handleRetry, loading: retrying }}
          />
        ) : articles.length === 0 ? (
          // Genuine empty — no articles for this filter
          <EmptyState
            variant="empty"
            action={{
              label: 'Show All News',
              onClick: () => handleCategoryChange('All'),
            }}
          />
        ) : (
          <>
            <div className="space-y-4">
              {articles.map((article, i) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  index={i}
                  featured={i === 0 && activeCategory === 'All'}
                />
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={loaderRef} className="h-12 flex items-center justify-center">
              {loadingMore && (
                <span className="w-5 h-5 border-2 border-border dark:border-dark-border border-t-accent rounded-full animate-spin" />
              )}
              {!loadingMore && articles.length >= total && articles.length > 0 && (
                <p className="text-xs font-sans text-gray-400 dark:text-gray-600">
                  You&apos;re all caught up
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
