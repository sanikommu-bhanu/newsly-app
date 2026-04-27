'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Settings, Bookmark, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'

const NAV_ITEMS = [
  { href: '/home', key: 'home', Icon: Home },
  { href: '/explore', key: 'explore', Icon: Compass },
  { href: '/bookmarks', key: 'saved', Icon: Bookmark },
  { href: '/profile', key: 'profile', Icon: User },
  { href: '/settings', key: 'settings', Icon: Settings },
]

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/home') {
    // /home is active on /home itself AND article detail pages
    // but NOT on /explore or /settings
    return pathname === '/home' || pathname.startsWith('/article/')
  }
  return pathname === href || pathname.startsWith(href + '/')
}

export default function BottomNav() {
  const pathname = usePathname()
  const { language } = useStore()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white/92 dark:bg-dark-surface/92 backdrop-blur-xl shadow-nav pb-safe border-t border-border/60 dark:border-dark-border/60"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto h-[56px]">
        {NAV_ITEMS.map(({ href, key, Icon }) => {
          const active = isNavActive(pathname, href)
          const label = t(language, key)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-[3px] flex-1',
                'press-effect transition-colors duration-150 min-w-0',
                active
                  ? 'text-accent'
                  : 'text-muted dark:text-gray-500 hover:text-ink dark:hover:text-gray-300'
              )}
            >
              <div className="relative flex items-center justify-center w-6 h-6">
                <Icon
                  size={21}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="transition-all duration-200"
                />
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-sans font-medium tracking-wide leading-none',
                  active ? 'text-accent' : 'text-muted dark:text-gray-500'
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
