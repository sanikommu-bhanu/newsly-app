'use client'

import { motion } from 'framer-motion'
import { RefreshCw, Newspaper, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** 'empty' = no articles for filter, 'error' = API/network failure, 'offline' = no connection */
  variant?: 'empty' | 'error' | 'offline'
  title?: string
  message?: string
  action?: { label: string; onClick: () => void; loading?: boolean }
  className?: string
}

const DEFAULTS = {
  empty: {
    icon: Newspaper,
    iconClass: 'text-muted dark:text-gray-500',
    iconBg: 'bg-gray-100 dark:bg-dark-surface',
    title: 'No news right now',
    message: 'No articles available for this filter. Try a different category or check back soon.',
  },
  error: {
    icon: RefreshCw,
    iconClass: 'text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/50',
    title: 'Couldn\'t load news',
    message: 'Something went wrong fetching articles. Your connection may be slow or the server is busy.',
  },
  offline: {
    icon: WifiOff,
    iconClass: 'text-muted dark:text-gray-500',
    iconBg: 'bg-gray-100 dark:bg-dark-surface',
    title: 'No connection',
    message: 'Showing cached articles. Connect to the internet to get the latest news.',
  },
}

export default function EmptyState({
  variant = 'empty',
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant]
  const Icon = defaults.icon

  const displayTitle = title ?? defaults.title
  const displayMessage = message ?? defaults.message

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center py-20 px-6 text-center',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center mb-4',
          defaults.iconBg
        )}
      >
        <Icon
          size={22}
          strokeWidth={1.6}
          className={defaults.iconClass}
        />
      </div>

      {/* Text */}
      <h3 className="font-display text-[17px] font-semibold text-ink dark:text-gray-100 mb-2">
        {displayTitle}
      </h3>
      <p className="text-sm font-sans text-muted dark:text-gray-500 max-w-[260px] leading-relaxed">
        {displayMessage}
      </p>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.loading}
          className={cn(
            'mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl',
            'bg-ink dark:bg-white text-white dark:text-ink',
            'text-sm font-sans font-semibold press-effect',
            'shadow-card disabled:opacity-60 transition-opacity'
          )}
        >
          {action.loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 dark:border-ink/30 border-t-white dark:border-t-ink rounded-full animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <RefreshCw size={14} strokeWidth={2.5} />
              {action.label}
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}
