'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BookmarkCheck, Download } from 'lucide-react'
import { useStore } from '@/lib/store'
import { fetchBookmarks, getBookmarkExportUrl } from '@/lib/api'
import { t } from '@/lib/i18n'
import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import ArticleCard from '@/components/ArticleCard'
import Footer from '@/components/Footer'

export default function BookmarksPage() {
  const router = useRouter()
  const { user, token, bookmarks, setBookmarks, language } = useStore()

  useEffect(() => {
    if (!user) router.replace('/')
  }, [user, router])

  useEffect(() => {
    if (!token) return
    fetchBookmarks(token)
      .then(setBookmarks)
      .catch(() => {})
  }, [token, setBookmarks])

  const exportBookmarks = async () => {
    if (!token) return
    const res = await fetch(getBookmarkExportUrl(), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'newsly-bookmarks.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-24">
      <ThemeSync />

      <header className="sticky top-0 z-40 bg-[#FAFAFA]/90 dark:bg-dark-bg/90 backdrop-blur-md px-5 pt-12 pb-4">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">
          {t(language, 'saved')}
        </h1>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs font-sans text-muted dark:text-gray-500">{bookmarks.length} saved</p>
          {token ? (
            <button
              onClick={exportBookmarks}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[11px] font-medium text-ink dark:border-dark-border dark:bg-dark-surface dark:text-white"
            >
              <Download size={12} />
              {t(language, 'exportBookmarks')}
            </button>
          ) : null}
        </div>
      </header>

      <main className="px-4 pt-3">
        {bookmarks.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-white p-6 text-center dark:border-dark-border dark:bg-dark-surface">
            <BookmarkCheck className="mx-auto mb-3 text-accent" size={24} />
            <p className="font-sans text-sm text-muted dark:text-gray-400">
              No bookmarks yet. Save stories from Home or Explore.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((article, i) => (
              <ArticleCard key={article.id} article={article} index={i} />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
