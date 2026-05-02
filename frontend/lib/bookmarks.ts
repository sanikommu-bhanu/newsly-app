'use client'

import type { Article } from '@/types'

const BOOKMARKS_KEY = 'newsly-bookmarks-v1'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function safeRead(): Article[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Article[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function safeWrite(items: Article[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(items))
  } catch {
    // Ignore quota or serialization errors.
  }
}

export function getSavedArticles(): Article[] {
  return safeRead()
}

export function saveArticle(article: Article): Article[] {
  const items = safeRead()
  if (items.some((a) => a.id === article.id)) return items
  const next = [article, ...items].slice(0, 100)
  safeWrite(next)
  return next
}

export function removeArticle(articleId: string): Article[] {
  const next = safeRead().filter((a) => a.id !== articleId)
  safeWrite(next)
  return next
}

export function replaceSavedArticles(items: Article[]): Article[] {
  const deduped: Article[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    deduped.push(item)
  }
  safeWrite(deduped.slice(0, 100))
  return deduped.slice(0, 100)
}
