'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ToneType } from '@/types'

// ── Bias label formatter ───────────────────────────────────────────────────────
// Turns raw backend string (e.g. "Center-Left") into readable label
function formatBias(bias: string | null | undefined): string {
  if (!bias) return ''
  // Map common values to user-facing labels
  const labels: Record<string, string> = {
    'Left':         'Left-leaning',
    'Center-Left':  'Slight left lean',
    'Center':       'Balanced',
    'Center-Right': 'Slight right lean',
    'Right':        'Right-leaning',
  }
  return labels[bias] ?? bias
}

// ── Tone config ────────────────────────────────────────────────────────────────
const TONE_CONFIG: Record<
  ToneType,
  { dot: string; bg: string; text: string; darkBg: string; darkText: string; whyBg: string; whyDark: string }
> = {
  Positive: {
    dot:     'bg-emerald-400',
    bg:      'bg-emerald-50',
    text:    'text-emerald-700',
    darkBg:  'dark:bg-emerald-950',
    darkText:'dark:text-emerald-300',
    whyBg:   'bg-emerald-100/80 dark:bg-emerald-900/50',
    whyDark: '',
  },
  Neutral: {
    dot:     'bg-gray-400',
    bg:      'bg-gray-100',
    text:    'text-gray-600',
    darkBg:  'dark:bg-gray-800',
    darkText:'dark:text-gray-400',
    whyBg:   'bg-gray-200/70 dark:bg-gray-700/50',
    whyDark: '',
  },
  Negative: {
    dot:     'bg-rose-400',
    bg:      'bg-rose-50',
    text:    'text-rose-700',
    darkBg:  'dark:bg-rose-950',
    darkText:'dark:text-rose-300',
    whyBg:   'bg-rose-100/80 dark:bg-rose-900/50',
    whyDark: '',
  },
}

interface InsightTagProps {
  tone?: ToneType | null
  bias?: string | null
  size?: 'sm' | 'md'
  /** When true, shows a small "Why?" button that expands to show emotional keywords */
  expandable?: boolean
  /** Emotional keywords from the AI processor — shown in the Why expansion */
  emotionalWords?: string[]
  className?: string
}

export default function InsightTag({
  tone,
  bias,
  size = 'sm',
  expandable = false,
  emotionalWords = [],
  className,
}: InsightTagProps) {
  const [open, setOpen] = useState(false)

  if (!tone) return null

  const config = TONE_CONFIG[tone] ?? TONE_CONFIG.Neutral
  const biasLabel = formatBias(bias)

  // The main pill label: "Neutral • Balanced" or just "Positive"
  const label = biasLabel
    ? `${tone} · ${biasLabel}`
    : tone

  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      {/* ── Main pill ──────────────────────────────────────────────────── */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-sans font-medium tracking-tight',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
          config.bg,
          config.text,
          config.darkBg,
          config.darkText
        )}
      >
        {/* Tone dot */}
        <span
          className={cn(
            'rounded-full flex-shrink-0',
            config.dot,
            size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
          )}
        />

        {label}

        {/* "Why?" button — only when expandable and there are words to show */}
        {expandable && emotionalWords.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()    // don't follow the parent Link
              e.stopPropagation()
              setOpen((v) => !v)
            }}
            aria-expanded={open}
            aria-label="Why this insight?"
            className={cn(
              'ml-0.5 rounded-full px-1.5 py-px font-sans font-semibold leading-none transition-opacity',
              'text-[9px] uppercase tracking-widest',
              'opacity-60 hover:opacity-100',
              config.bg,
              config.text
            )}
          >
            {open ? 'Close' : 'Why?'}
          </button>
        )}
      </span>

      {/* ── Why expansion ──────────────────────────────────────────────── */}
      {expandable && open && emotionalWords.length > 0 && (
        <span
          className={cn(
            'inline-flex flex-col gap-1.5 rounded-xl px-3 py-2.5',
            'text-xs font-sans max-w-[260px]',
            config.bg,
            config.text,
            config.darkBg,
            config.darkText
          )}
        >
          <span className="font-semibold text-[10px] uppercase tracking-widest opacity-70">
            Detected signals
          </span>
          <span className="flex flex-wrap gap-1.5">
            {emotionalWords.map((word) => (
              <span
                key={word}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium capitalize',
                  config.whyBg,
                  config.text,
                  config.darkText
                )}
              >
                {word}
              </span>
            ))}
          </span>
          <span className="text-[11px] leading-relaxed opacity-75 mt-0.5">
            Tone is determined by keyword frequency and sentiment scoring. Bias reflects the source&apos;s general editorial position.
          </span>
        </span>
      )}
    </span>
  )
}
