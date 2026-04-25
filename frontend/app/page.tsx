'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, LogIn } from 'lucide-react'
import { useStore } from '@/lib/store'
import ThemeSync from '@/components/ThemeSync'
import NewslyLogo from '@/components/NewslyLogo'

const LOADING_STEPS = [
  'Collecting trusted headlines',
  'Personalizing your briefing',
  'Preparing your calm reading space',
]

type LaunchPhase = 'loading' | 'enter'

export default function LandingPage() {
  const router = useRouter()
  const { user, onboardingComplete, trackSession } = useStore()
  const [phase, setPhase] = useState<LaunchPhase>('loading')
  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    trackSession()
  }, [trackSession])

  useEffect(() => {
    if (phase !== 'loading') return

    const rotateSteps = setInterval(() => {
      setStepIndex((idx) => (idx + 1) % LOADING_STEPS.length)
    }, 700)

    return () => clearInterval(rotateSteps)
  }, [phase])

  useEffect(() => {
    if (!hydrated) return

    const launchTimer = setTimeout(() => {
      if (user && onboardingComplete) {
        router.replace('/home')
        return
      }
      if (user) {
        router.replace('/onboarding')
        return
      }
      setPhase('enter')
    }, 2300)

    return () => clearTimeout(launchTimer)
  }, [hydrated, user, onboardingComplete, router])

  const openAuth = () => router.push('/auth')

  const openLogin = () => router.push('/auth?mode=login')

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F6F8FC] dark:bg-dark-bg">
      <ThemeSync />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-[-120px] h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl dark:bg-cyan-400/15" />
        <div className="absolute -right-20 bottom-[-110px] h-72 w-72 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-500/15" />
      </div>

      <AnimatePresence mode="wait">
        {phase === 'loading' ? (
          <motion.section
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 flex min-h-screen flex-col items-center justify-center px-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <NewslyLogo size="lg" showWordmark />
            </motion.div>

            <p className="mt-4 max-w-[280px] text-center font-sans text-sm text-muted dark:text-gray-400">
              Turning noisy headlines into clear, personalized signal.
            </p>

            <div className="mt-12 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-slate-300/70 dark:bg-slate-700/60">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#1D4ED8,#06B6D4)]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <p className="mt-4 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-muted dark:text-gray-500">
              {LOADING_STEPS[stepIndex]}
            </p>
          </motion.section>
        ) : (
          <motion.section
            key="enter"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="relative z-10 flex min-h-screen flex-col px-6 pb-16 pt-10"
          >
            <header>
              <NewslyLogo size="sm" showWordmark />
            </header>

            <div className="flex flex-1 flex-col justify-center">
              <p className="mb-5 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Your daily briefing app
              </p>

              <h1 className="max-w-[340px] font-display text-[2.35rem] font-semibold leading-tight text-ink dark:text-white">
                Real news, cleaner focus, smarter insight.
              </h1>

              <p className="mt-5 max-w-[330px] font-sans text-base leading-relaxed text-muted dark:text-gray-400">
                Built for people who want trusted headlines without doomscrolling.
                Summaries, tone, and bias signals are ready in one calm feed.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {['Source-first', 'AI summaries', 'Bias signal', 'No ad clutter'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border bg-white/90 px-3 py-1.5 text-xs font-sans font-medium text-muted shadow-sm dark:border-dark-border dark:bg-dark-surface/90 dark:text-gray-400"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={openAuth}
                className="flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-sans text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-lg dark:bg-white dark:text-ink"
              >
                Enter Newsly
                <ArrowRight size={16} strokeWidth={2.5} />
              </motion.button>

              <button
                onClick={openLogin}
                className="flex items-center justify-center gap-2 rounded-full border border-border bg-white/85 px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-white dark:border-dark-border dark:bg-dark-surface dark:text-white dark:hover:bg-[#1E1E22]"
              >
                I already have an account
                <LogIn size={15} />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  )
}
