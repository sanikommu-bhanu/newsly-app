import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function truncate(text: string, length: number): string {
  if (!text) return ''
  return text.length > length ? text.slice(0, length).trimEnd() + '…' : text
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Politics: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    Technology: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    Business: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    World: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    Health: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    Sports: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    Entertainment: 'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  }
  return colors[category] ?? 'bg-gray-50 text-gray-600'
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function sourceCredibility(source: string): {
  label: 'High' | 'Standard'
  toneClass: string
} {
  const trusted = ['BBC', 'Reuters', 'The Hindu', 'Associated Press', 'AP']
  const normalized = source.toLowerCase()
  const high = trusted.some((s) => normalized.includes(s.toLowerCase()))
  return high
    ? {
        label: 'High',
        toneClass:
          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      }
    : {
        label: 'Standard',
        toneClass: 'bg-gray-100 text-gray-600 dark:bg-dark-bg dark:text-gray-400',
      }
}
