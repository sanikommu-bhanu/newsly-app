'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const ALL_CATEGORIES = [
  'All',
  'Politics',
  'Technology',
  'Business',
  'World',
  'Health',
  'Sports',
  'Entertainment',
]

interface CategoryTabsProps {
  active: string
  onChange: (category: string) => void
}

export default function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleClick = (category: string) => {
    onChange(category)

    // Scroll the active tab into view
    const container = scrollRef.current
    if (!container) return
    const el = container.querySelector<HTMLButtonElement>(`[data-cat="${category}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto no-scrollbar scroll-touch px-4 py-1"
    >
      {ALL_CATEGORIES.map((cat) => {
        const isActive = active === cat
        return (
          <button
            key={cat}
            data-cat={cat}
            onClick={() => handleClick(cat)}
            className={cn(
              'relative flex-shrink-0 px-4 py-2 rounded-full text-sm font-sans font-medium',
              'transition-colors duration-200 press-effect',
              isActive
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-white text-muted dark:bg-dark-surface dark:text-gray-400',
              !isActive && 'shadow-card hover:bg-gray-50 dark:hover:bg-dark-surface/80'
            )}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
