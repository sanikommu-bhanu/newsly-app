'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { savePreferences } from '@/lib/api'
import { LOCATIONS, CATEGORIES } from '@/types'
import { cn } from '@/lib/utils'
import ThemeSync from '@/components/ThemeSync'

const CATEGORY_ICONS: Record<string, string> = {
  Politics: '🏛️',
  Technology: '💡',
  Business: '📈',
  World: '🌍',
  Health: '🩺',
  Sports: '⚽',
  Entertainment: '🎬',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { token, setPreferences, completeOnboarding, darkMode } = useStore()
  const [step, setStep] = useState(1)
  const [selectedLocation, setSelectedLocation] = useState('Global')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleFinish = async () => {
    setSaving(true)
    const cats = selectedCategories.length > 0 ? selectedCategories : [...CATEGORIES]

    // Persist to store
    setPreferences(selectedLocation, cats)
    completeOnboarding()

    // Attempt to sync with backend (non-blocking)
    if (token) {
      savePreferences({ location: selectedLocation, categories: cats }, token).catch(() => {})
    }

    setSaving(false)
    router.replace('/home')
  }

  const slideVariants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg flex flex-col px-6">
      <ThemeSync />

      {/* Progress bar */}
      <div className="pt-14 pb-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-sans font-medium text-muted dark:text-gray-500">
            Step {step} of 2
          </span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-dark-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: step === 1 ? '50%' : '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Step 1 — Location */}
              <div className="mb-8">
                <h1 className="font-display text-[1.85rem] font-semibold text-ink dark:text-white leading-tight mb-2">
                  Where are you based?
                </h1>
                <p className="text-sm font-sans text-muted dark:text-gray-400">
                  {"We'll prioritise news relevant to your region."}
                </p>
              </div>

              <div className="space-y-3">
                {LOCATIONS.map(({ id, label, emoji }) => {
                  const isSelected = selectedLocation === id
                  return (
                    <motion.button
                      key={id}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => setSelectedLocation(id)}
                      className={cn(
                        'w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200',
                        isSelected
                          ? 'bg-ink dark:bg-white border-ink dark:border-white'
                          : 'bg-white dark:bg-dark-surface border-border dark:border-dark-border'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{emoji}</span>
                        <span
                          className={cn(
                            'font-sans font-medium text-[15px]',
                            isSelected
                              ? 'text-white dark:text-ink'
                              : 'text-ink dark:text-gray-200'
                          )}
                        >
                          {label}
                        </span>
                      </div>
                      {isSelected && (
                        <Check
                          size={18}
                          strokeWidth={2.5}
                          className="text-white dark:text-ink"
                        />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep(2)}
                className="mt-8 w-full flex items-center justify-center gap-2 bg-ink dark:bg-white text-white dark:text-ink font-sans font-semibold text-sm py-3.5 rounded-xl"
              >
                Continue
                <ArrowRight size={16} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Step 2 — Categories */}
              <div className="mb-8">
                <h1 className="font-display text-[1.85rem] font-semibold text-ink dark:text-white leading-tight mb-2">
                  What do you follow?
                </h1>
                <p className="text-sm font-sans text-muted dark:text-gray-400">
                  Pick topics you care about. You can change these anytime.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat)
                  return (
                    <motion.button
                      key={cat}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        'flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border transition-all duration-200 text-left',
                        isSelected
                          ? 'bg-ink dark:bg-white border-ink dark:border-white'
                          : 'bg-white dark:bg-dark-surface border-border dark:border-dark-border'
                      )}
                    >
                      <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                      <span
                        className={cn(
                          'font-sans font-medium text-sm',
                          isSelected
                            ? 'text-white dark:text-ink'
                            : 'text-ink dark:text-gray-200'
                        )}
                      >
                        {cat}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              <p className="mt-4 text-center text-xs font-sans text-gray-400 dark:text-gray-600">
                {selectedCategories.length === 0
                  ? "Nothing selected — we'll show everything"
                  : `${selectedCategories.length} topic${selectedCategories.length > 1 ? 's' : ''} selected`}
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl border border-border dark:border-dark-border text-sm font-sans font-medium text-muted dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-dark-surface"
                >
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-[2] flex items-center justify-center gap-2 bg-ink dark:bg-white text-white dark:text-ink font-sans font-semibold text-sm py-3.5 rounded-xl disabled:opacity-60"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Start Reading
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
