'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Bookmark, Share2 } from 'lucide-react'
import { cn, relativeTime, getCategoryColor, sourceCredibility } from '@/lib/utils'
import InsightTag from './InsightTag'
import { useStore } from '@/lib/store'
import { removeBookmark, trackInteraction, upsertBookmark } from '@/lib/api'
import type { Article } from '@/types'

interface ArticleCardProps {
  article: Article
  index?: number
  featured?: boolean
}

// ── Category fallback colors (used when there's no image) ─────────────────────
const CATEGORY_FALLBACK_STYLE: Record<
  string,
  { bg: string; darkBg: string; iconColor: string }
> = {
  Technology:    { bg: 'bg-blue-50',    darkBg: 'dark:bg-blue-950/60',   iconColor: 'text-blue-400' },
  Politics:      { bg: 'bg-rose-50',    darkBg: 'dark:bg-rose-950/60',   iconColor: 'text-rose-400' },
  Business:      { bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/60',iconColor: 'text-emerald-400' },
  Health:        { bg: 'bg-teal-50',    darkBg: 'dark:bg-teal-950/60',   iconColor: 'text-teal-400' },
  Sports:        { bg: 'bg-orange-50',  darkBg: 'dark:bg-orange-950/60', iconColor: 'text-orange-400' },
  Entertainment: { bg: 'bg-pink-50',    darkBg: 'dark:bg-pink-950/60',   iconColor: 'text-pink-400' },
  World:         { bg: 'bg-violet-50',  darkBg: 'dark:bg-violet-950/60', iconColor: 'text-violet-400' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  Technology: '💡', Politics: '🏛️', Business: '📈',
  Health: '🩺', Sports: '⚽', Entertainment: '🎬', World: '🌍',
}

// ── Styled fallback shown when no image is available ──────────────────────────
function ImageFallback({
  category,
  title,
  featured,
}: {
  category: string
  title: string
  featured: boolean
}) {
  const style = CATEGORY_FALLBACK_STYLE[category] ?? CATEGORY_FALLBACK_STYLE.World
  const emoji = CATEGORY_EMOJI[category] ?? '📰'

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col items-center justify-center gap-3 px-5',
        style.bg,
        style.darkBg
      )}
    >
      <span className="text-3xl leading-none select-none">{emoji}</span>
      <p
        className={cn(
          'font-display font-semibold text-center leading-snug line-clamp-2',
          featured ? 'text-[15px]' : 'text-[13px]',
          'text-ink/60 dark:text-white/50'
        )}
      >
        {title}
      </p>
    </div>
  )
}

export default function ArticleCard({
  article,
  index = 0,
  featured = false,
}: ArticleCardProps) {
  const { aiEnabled, toggleBookmark, isBookmarked, token, trackShare } = useStore()
  // Track per-card image load failure
  const [imgError, setImgError] = useState(false)
  const bookmarked = isBookmarked(article.id)
  const credibility = sourceCredibility(article.source)
  const hasInternalRoute = Boolean(article.id?.trim())
  const externalUrl = article.article_url && article.article_url !== '#' ? article.article_url : null

  // Show image only when the article actually has a URL and it hasn't failed
  const showImage = Boolean(article.image_url) && !imgError

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.38,
        delay: Math.min(index * 0.055, 0.35),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={hasInternalRoute ? `/article/${encodeURIComponent(article.id)}` : (externalUrl ?? '#')}
        target={!hasInternalRoute && externalUrl ? '_blank' : undefined}
        rel={!hasInternalRoute && externalUrl ? 'noopener noreferrer' : undefined}
        className="block group outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-2xl"
      >
        <article
          className={cn(
            'bg-white dark:bg-dark-surface rounded-2xl overflow-hidden',
            'shadow-card transition-all duration-200',
            'group-hover:shadow-card-hover group-active:scale-[0.992]',
            featured && 'ring-1 ring-border dark:ring-dark-border'
          )}
        >
          {/* ── Image / Fallback ──────────────────────────────────────────── */}
          <div
            className={cn(
              'relative overflow-hidden',
              featured ? 'aspect-[16/9]' : 'aspect-video'
            )}
          >
            {showImage ? (
              /* Real image — replace with fallback on any load error */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.image_url!}
                alt=""
                role="presentation"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                loading={index < 2 ? 'eager' : 'lazy'}
                decoding="async"
                onError={() => setImgError(true)}
              />
            ) : (
              /* No image or broken URL — clean styled placeholder */
              <ImageFallback
                category={article.category}
                title={article.title}
                featured={featured}
              />
            )}

            {/* Bottom gradient — only over a real photo so text stays readable */}
            {showImage && (
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            )}

            {/* Insight tag — hidden when user has turned AI off */}
            {aiEnabled && article.tone && (
              <div
                className={cn(
                  'absolute pointer-events-none',
                  showImage ? 'bottom-2.5 left-3' : 'top-2.5 right-3'
                )}
              >
                <InsightTag tone={article.tone} bias={article.bias} />
              </div>
            )}
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
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
              }}
              aria-label="Share article"
              className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full border bg-white/85 dark:bg-dark-surface/85 text-muted dark:text-gray-300 border-border dark:border-dark-border backdrop-blur-sm flex items-center justify-center transition-colors"
            >
              <Share2 size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
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
              aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
              className={cn(
                'absolute top-2.5 right-2.5 w-8 h-8 rounded-full border backdrop-blur-sm flex items-center justify-center transition-colors',
                bookmarked
                  ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white'
                  : 'bg-white/85 dark:bg-dark-surface/85 text-muted dark:text-gray-300 border-border dark:border-dark-border'
              )}
            >
              <Bookmark size={14} className={bookmarked ? 'fill-current' : ''} />
            </button>
          </div>

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div className="p-4">
            {/* Category badge */}
            <span
              className={cn(
                'inline-block text-[10px] font-sans font-semibold tracking-wider uppercase rounded-full px-2 py-0.5 mb-2.5',
                getCategoryColor(article.category)
              )}
            >
              {article.category}
            </span>

            {/* Title */}
            <h2
              className={cn(
                'font-display font-semibold text-ink dark:text-gray-50 leading-snug mb-2 line-clamp-2',
                featured ? 'text-[19px]' : 'text-[17px]'
              )}
            >
              {article.title}
            </h2>

            {/* Description */}
            {article.description && (
              <p className="text-[13.5px] font-sans text-muted dark:text-gray-400 line-clamp-3 leading-relaxed mb-3">
                {article.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 opacity-80" />
                <span className="text-xs font-sans font-medium text-muted dark:text-gray-500 truncate">
                  {article.source}
                </span>
              </div>
              <div className="ml-2 flex flex-col items-end text-xs font-sans text-muted dark:text-gray-500">
                <span>{relativeTime(article.published_at)}</span>
                {article.read_time_minutes ? <span>{article.read_time_minutes} min</span> : null}
              </div>
            </div>
            <div className="mt-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-sans font-semibold',
                  credibility.toneClass
                )}
              >
                Source credibility: {credibility.label}
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  )
}
