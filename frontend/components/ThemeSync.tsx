'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export default function ThemeSync() {
  const darkMode = useStore((s) => s.darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return null
}
