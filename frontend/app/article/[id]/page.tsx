'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Clock, Share2, Bookmark } from 'lucide-react'
import {
  fetchArticle,
  fetchNews,
  fetchComments,
  fetchRelated,
  postComment,
  removeBookmark,
  trackInteraction,
  upsertBookmark,
} from '@/lib/api'
import { t } from '@/lib/i18n'
import { relativeTime, getCategoryColor, cn, sourceCredibility } from '@/lib/utils'
import { useStore } from '@/lib/store'
import type { Article, ArticleComment } from '@/types'

import ThemeSync from '@/components/ThemeSync'
import InsightTag from '@/components/InsightTag'
import Footer from '@/components/Footer'
import BottomNav from '@/components/BottomNav'

// ── Category fallback — same colors as ArticleCard ────────────────────────────
const FALLBACK_IMAGES: Record<string, string> = {
  Technology:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&auto=format&fit=crop&q=80',
  Politics:
    'https://images.unsplash.com/photo-1529107386315-e1a2ef112a72?w=900&auto=format&fit=crop&q=80',
  Business:
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&auto=format&fit=crop&q=80',
  Health:
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&auto=format&fit=crop&q=80',
  Sports:
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&auto=format&fit=crop&q=80',
  Entertainment:
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=900&auto=format&fit=crop&q=80',
  World:
    'https://images.unsplash.com/photo-1526958977630-b4fcd9f9898b?w=900&auto=format&fit=crop&q=80',
}

const CATEGORY_FALLBACK_STYLE: Record<string, { bg: string; darkBg: string }> = {
  Technology:    { bg: 'bg-blue-50',    darkBg: 'dark:bg-blue-950/60' },
  Politics:      { bg: 'bg-rose-50',    darkBg: 'dark:bg-rose-950/60' },
  Business:      { bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/60' },
  Health:        { bg: 'bg-teal-50',    darkBg: 'dark:bg-teal-950/60' },
  Sports:        { bg: 'bg-orange-50',  darkBg: 'dark:bg-orange-950/60' },
  Entertainment: { bg: 'bg-pink-50',    darkBg: 'dark:bg-pink-950/60' },
  World:         { bg: 'bg-violet-50',  darkBg: 'dark:bg-violet-950/60' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  Technology: '💡', Politics: '🏛️', Business: '📈',
  Health: '🩺', Sports: '⚽', Entertainment: '🎬', World: '🌍',
}

const TONE_LABEL: Record<string, string> = {
  Positive: 'Largely positive reporting',
  Neutral:  'Mostly neutral reporting',
  Negative: 'Critical or negative framing',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg">
      <div className="aspect-[4/3] skeleton" />
      <div className="px-5 pt-5 space-y-4 max-w-lg mx-auto">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="space-y-2.5">
          <div className="skeleton h-7 w-full rounded" />
          <div className="skeleton h-7 w-5/6 rounded" />
          <div className="skeleton h-7 w-3/5 rounded" />
        </div>
        <div className="skeleton h-4 w-36 rounded" />
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn('skeleton h-4 rounded', i === 3 ? 'w-3/4' : 'w-full')} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Hero image with clean fallback ────────────────────────────────────────────
function HeroImage({ article }: { article: Article }) {
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(article.image_url) && !imgError
  const fallbackStyle = CATEGORY_FALLBACK_STYLE[article.category] ?? CATEGORY_FALLBACK_STYLE.World
  const emoji = CATEGORY_EMOJI[article.category] ?? '📰'

  return (
    <div className="relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.image_url!}
          alt=""
          role="presentation"
          className="w-full h-full object-cover"
          loading="eager"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex flex-col items-center justify-center gap-4 px-8',
            fallbackStyle.bg,
            fallbackStyle.darkBg
          )}
        >
          <span className="text-5xl leading-none">{emoji}</span>
          <p className="font-display text-[17px] font-semibold text-center leading-snug line-clamp-3 text-ink/60 dark:text-white/50">
            {article.title}
          </p>
        </div>
      )}

      {/* Bottom gradient — only on real photos */}
      {showImage && (
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ArticlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const {
    aiEnabled,
    toggleBookmark,
    isBookmarked,
    trackArticleRead,
    trackShare,
    token,
    language,
  } = useStore()

  const [article, setArticle] = useState<Article | null>(null)
  const [related, setRelated] = useState<Article[]>([])
  const [comments, setComments] = useState<ArticleComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasReadableSource = Boolean(article?.article_url && article.article_url !== '#')

  useEffect(() => {
    fetchArticle(id)
      .then((found) => {
        setArticle(found)
        trackArticleRead()
        if (token) {
          void trackInteraction(token, {
            article_id: found.id,
            action: 'read',
            category: found.category,
            source: found.source,
          }).catch(() => {})
        }
      })
      .catch(() => setError('Article not found.'))
      .finally(() => setLoading(false))
  }, [id, trackArticleRead, token])

  useEffect(() => {
    if (!article) return
    fetchRelated(article.id, 3)
      .then(async (rows) => {
        if (rows.length > 0) {
          setRelated(rows)
          return
        }
        const fallback = await fetchNews({ category: article.category, page: 1, limit: 6 })
        setRelated(fallback.articles.filter((a) => a.id !== article.id).slice(0, 3))
      })
      .catch(() => setRelated([]))
  }, [article])

  useEffect(() => {
    if (!article) return
    fetchComments(article.id).then(setComments).catch(() => setComments([]))
  }, [article])

  const handleShare = async () => {
    if (!article) return
    const sharePayload = {
      title: article.title,
      text: article.description ?? 'Read this article on Newsly',
      url: article.article_url,
    }
    try {
      if (navigator.share) {
        await navigator.share(sharePayload)
      } else {
        await navigator.clipboard.writeText(article.article_url)
      }
      trackShare()
      if (token) {
        void trackInteraction(token, {
          article_id: article.id,
          action: 'share',
          category: article.category,
          source: article.source,
        }).catch(() => {})
      }
    } catch {
      // User canceled share sheet or clipboard write failed.
    }
  }

  const onCommentSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !article || !commentText.trim()) return
    try {
      setCommentLoading(true)
      const created = await postComment(article.id, commentText.trim(), token)
      setComments((prev) => [created, ...prev])
      void trackInteraction(token, {
        article_id: article.id,
        action: 'comment',
        category: article.category,
        source: article.source,
      }).catch(() => {})
      setCommentText('')
    } finally {
      setCommentLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <ThemeSync />
        <ArticleSkeleton />
      </>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg flex items-center justify-center px-6">
        <ThemeSync />
        <div className="text-center">
          <p className="text-4xl mb-4">📰</p>
          <p className="font-display text-lg font-semibold text-ink dark:text-white mb-2">
            Article not found
          </p>
          <p className="text-sm font-sans text-muted dark:text-gray-500 mb-6 max-w-[260px] mx-auto">
            It may have expired from the cache. Try refreshing the feed.
          </p>
          <button
            onClick={() => router.back()}
            className="text-sm font-sans font-semibold text-accent hover:underline"
          >
            ← Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-28">
      <ThemeSync />

      {/* Floating back button */}
      <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
        <div className="max-w-lg mx-auto px-4 pt-12">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-white/85 dark:bg-dark-surface/85 backdrop-blur-md shadow-card press-effect border border-border/50 dark:border-dark-border/50"
          >
            <ArrowLeft size={18} strokeWidth={2.2} className="text-ink dark:text-white" />
          </button>
        </div>
      </div>

      {/* Hero */}
      <HeroImage article={article} />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-lg mx-auto"
      >
        <article className="px-5">

          {/* ── Category + AI tone row ──────────────────────────────────── */}
          <div className="flex items-start gap-2 pt-5 pb-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-sans font-semibold tracking-wider uppercase rounded-full px-2.5 py-1 mt-0.5',
                getCategoryColor(article.category)
              )}
            >
              {article.category}
            </span>

            {/* Insight tag — expandable with Why? button, gated by aiEnabled */}
            {aiEnabled && article.tone && (
              <InsightTag
                tone={article.tone}
                bias={article.bias}
                size="md"
                expandable
                emotionalWords={article.emotional_words ?? []}
              />
            )}
          </div>

          {/* Tone sentence — only when AI is on */}
          {aiEnabled && article.tone && (
            <p className="text-[13px] font-sans italic text-muted dark:text-gray-500 mb-3">
              {TONE_LABEL[article.tone] ?? 'AI analysis available for this article.'}
            </p>
          )}

          {/* Title */}
          <h1 className="font-display text-[1.5rem] sm:text-[1.65rem] font-semibold text-ink dark:text-white leading-snug mb-4">
            {article.title}
          </h1>

          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-sans font-medium text-ink dark:border-dark-border dark:bg-dark-surface dark:text-white"
            >
              <Share2 size={12} />
              {t(language, 'share')}
            </button>
            <button
              onClick={() => {
                const currently = isBookmarked(article.id)
                toggleBookmark(article)
                if (token) {
                  if (currently) {
                    void removeBookmark(article.id, token).catch(() => {})
                  } else {
                    void upsertBookmark(article, token).catch(() => {})
                    void trackInteraction(token, {
                      article_id: article.id,
                      action: 'bookmark',
                      category: article.category,
                      source: article.source,
                    }).catch(() => {})
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-sans font-medium text-ink dark:border-dark-border dark:bg-dark-surface dark:text-white"
            >
              <Bookmark size={12} className={isBookmarked(article.id) ? 'fill-current' : ''} />
              {isBookmarked(article.id) ? 'Saved' : 'Save'}
            </button>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-[10px] font-sans font-semibold',
                sourceCredibility(article.source).toneClass
              )}
            >
              Credibility: {sourceCredibility(article.source).label}
            </span>
          </div>

          {/* Source + time + region */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              <span className="text-xs font-sans font-semibold text-accent">
                {article.source}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted dark:text-gray-500">
              <Clock size={11} strokeWidth={2} />
              <span className="text-xs font-sans">{relativeTime(article.published_at)}</span>
            </div>
            {article.read_time_minutes ? (
              <span className="text-xs font-sans text-muted dark:text-gray-500">
                {article.read_time_minutes} min read
              </span>
            ) : null}
            {article.region && article.region !== 'Global' && (
              <span className="text-xs font-sans text-muted dark:text-gray-500 bg-gray-100 dark:bg-dark-surface px-2 py-0.5 rounded-full">
                {article.region}
              </span>
            )}
          </div>

          {/* ── AI Summary — gated by aiEnabled ────────────────────────── */}
          {aiEnabled && article.summary && (
            <div className="mb-5 bg-accent-light dark:bg-blue-950/40 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-accent text-sm leading-none">✦</span>
                <span className="text-[10px] font-sans font-semibold text-accent dark:text-blue-300 tracking-widest uppercase">
                  AI Summary
                </span>
              </div>
              <p className="text-[14px] font-sans text-ink dark:text-blue-100 leading-relaxed">
                {article.summary}
              </p>
            </div>
          )}

          {/* Description */}
          {article.description && (
            <p className="text-[15px] font-sans text-ink/80 dark:text-gray-300 leading-relaxed mb-5">
              {article.description}
            </p>
          )}

          {/* ── Emotional words — gated by aiEnabled ───────────────────── */}
          {aiEnabled && article.emotional_words && article.emotional_words.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-sans font-semibold text-muted dark:text-gray-500 mb-2.5 uppercase tracking-widest">
                Key themes
              </p>
              <div className="flex flex-wrap gap-2">
                {article.emotional_words.map((word) => (
                  <span
                    key={word}
                    className="text-xs font-sans text-muted dark:text-gray-400 bg-gray-100 dark:bg-dark-surface px-3 py-1.5 rounded-full capitalize"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── AI off notice ───────────────────────────────────────────── */}
          {!aiEnabled && (
            <div className="mb-5 px-4 py-3 bg-gray-50 dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border">
              <p className="text-xs font-sans text-muted dark:text-gray-500">
                AI insights are turned off.{' '}
                <span className="text-accent font-medium">
                  Enable them in Settings.
                </span>
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-border dark:bg-dark-border mb-5" />

          {/* Read Full Article */}
          <div className="mb-5">
            <p className="text-xs font-sans text-muted dark:text-gray-500 mb-3 leading-relaxed">
              This is a preview. Full article belongs to{' '}
              <strong className="font-semibold text-ink dark:text-gray-300">
                {article.source}
              </strong>
              .
            </p>
            {hasReadableSource ? (
              <a
                href={article.article_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-ink dark:bg-white text-white dark:text-ink font-sans font-semibold text-sm py-4 rounded-2xl press-effect shadow-sm hover:shadow-md transition-shadow"
              >
                Read Full Article
                <ExternalLink size={15} strokeWidth={2.5} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-2 w-full bg-gray-300 text-white font-sans font-semibold text-sm py-4 rounded-2xl cursor-not-allowed dark:bg-gray-700"
              >
                Source link unavailable
              </button>
            )}
            <p className="mt-2 text-center text-[11px] font-sans text-gray-400 dark:text-gray-600">
              Opens {article.source} in your browser
            </p>
          </div>

          <section className="mb-6">
            <p className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-widest text-muted dark:text-gray-500">
              {t(language, 'comments')}
            </p>
            {token ? (
              <form onSubmit={onCommentSubmit} className="mb-3 space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts…"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-sans text-ink outline-none dark:border-dark-border dark:bg-dark-surface dark:text-white"
                />
                <button
                  type="submit"
                  disabled={commentLoading || !commentText.trim()}
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-ink"
                >
                  {commentLoading ? 'Posting...' : t(language, 'post')}
                </button>
              </form>
            ) : (
              <p className="mb-3 text-xs font-sans text-muted dark:text-gray-500">Log in to comment.</p>
            )}
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className="text-xs font-sans text-muted dark:text-gray-500">No comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl border border-border bg-white px-3 py-2 dark:border-dark-border dark:bg-dark-surface"
                  >
                    <p className="text-xs font-sans text-muted dark:text-gray-500">
                      {comment.username} • {relativeTime(comment.created_at)}
                    </p>
                    <p className="mt-1 text-sm font-sans text-ink dark:text-gray-100">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {related.length > 0 && (
            <section className="mb-6">
              <p className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-widest text-muted dark:text-gray-500">
                Related stories
              </p>
              <div className="space-y-2">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/article/${encodeURIComponent(item.id)}`}
                    className="block rounded-xl border border-border bg-white px-3 py-2 dark:border-dark-border dark:bg-dark-surface"
                  >
                    <p className="line-clamp-2 text-sm font-sans font-medium text-ink dark:text-gray-100">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs font-sans text-muted dark:text-gray-500">
                      {item.source}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>

        <Footer />
      </motion.div>

      <BottomNav />
    </div>
  )
}
