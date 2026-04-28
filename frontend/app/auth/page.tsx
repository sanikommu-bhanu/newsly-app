'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react'
import { fetchProfile, login, signup, socialGoogleLogin } from '@/lib/api'
import { useStore } from '@/lib/store'
import ThemeSync from '@/components/ThemeSync'

// ── Inner form — uses useSearchParams, must be wrapped in <Suspense> ─────────
function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth, setLegalAccepted } = useStore()

  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'login' ? 'login' : 'signup'
  )
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleGoogleLogin = async () => {
    setError('')
    const idToken = window.prompt('Paste your Google ID token')
    if (!idToken) return
    setLoading(true)
    try {
      const res = await socialGoogleLogin(idToken.trim())
      const profile = await fetchProfile(res.access_token)
      setAuth(
        {
          id: profile.user_id,
          email: profile.email,
          username: profile.username,
        },
        res.access_token
      )
      setLegalAccepted(true)
      router.push('/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }
    if (mode === 'signup' && !form.username) {
      setError('Username is required.')
      return
    }
    if (mode === 'signup' && !acceptedLegal) {
      setError('Please accept Terms and Privacy Policy to continue.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      let token: string
      if (mode === 'signup') {
        const res = await signup(form.email, form.username, form.password)
        token = res.access_token
      } else {
        const res = await login(form.email, form.password)
        token = res.access_token
      }
      setAuth(
        {
          id: 'local',
          email: form.email,
          username: form.username || form.email.split('@')[0],
        },
        token
      )
      if (mode === 'signup') setLegalAccepted(true)
      router.push('/onboarding')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-white dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl px-4 py-3.5 text-sm font-sans text-ink dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all'

  return (
    <>
      {/* Heading */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mb-8"
      >
        <h1 className="font-display text-[1.9rem] font-semibold text-ink dark:text-white leading-tight mb-2">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm font-sans text-muted dark:text-gray-400">
          {mode === 'signup'
            ? 'Free forever. No ads. Just clear news.'
            : 'Sign in to your Newsly account.'}
        </p>
      </motion.div>

      <div className="space-y-3.5">
        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl py-3.5 text-sm font-sans font-medium text-ink dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-border transition-colors press-effect shadow-card"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border dark:bg-dark-border" />
          <span className="text-xs font-sans text-gray-400">or</span>
          <div className="flex-1 h-px bg-border dark:bg-dark-border" />
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={inputClass}
          autoComplete="email"
          inputMode="email"
        />

        {/* Username (signup only) */}
        <AnimatePresence initial={false}>
          {mode === 'signup' && (
            <motion.div
              key="username-field"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                className={inputClass}
                autoComplete="username"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password */}
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            placeholder="Password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            className={`${inputClass} pr-12`}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? 'Hide password' : 'Show password'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-muted transition-colors p-1"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="auth-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              role="alert"
              className="flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-sm font-sans bg-rose-50 dark:bg-rose-950/50 rounded-xl px-4 py-3"
            >
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {mode === 'signup' && (
          <label className="flex items-start gap-2 text-xs font-sans text-muted dark:text-gray-500">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/terms" className="text-accent hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}

        {/* Submit */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-ink dark:bg-white text-white dark:text-ink font-sans font-semibold text-sm py-3.5 rounded-xl transition-opacity disabled:opacity-60 shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 dark:border-ink/30 border-t-white dark:border-t-ink rounded-full animate-spin" />
              {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
            </span>
          ) : mode === 'signup' ? (
            'Create Account'
          ) : (
            'Sign In'
          )}
        </motion.button>
      </div>

      {/* Mode toggle */}
      <p className="mt-6 text-center text-sm font-sans text-muted dark:text-gray-500 pb-8">
        {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
        <button
          onClick={() => {
            setMode(mode === 'signup' ? 'login' : 'signup')
            setError('')
            setForm({ email: '', username: '', password: '' })
          }}
          className="text-accent font-medium hover:underline"
        >
          {mode === 'signup' ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </>
  )
}

// ── Page wrapper — back button is outside Suspense ───────────────────────────
export default function AuthPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg flex flex-col px-6 max-w-lg mx-auto w-full">
      <ThemeSync />

      {/* Back */}
      <div className="pt-14 pb-6">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="p-2 -ml-2 text-muted dark:text-gray-500 hover:text-ink dark:hover:text-white transition-colors press-effect rounded-full"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Suspense boundary required for useSearchParams in Next.js 14 */}
      <Suspense
        fallback={
          <div className="space-y-5">
            <div className="skeleton h-9 w-52 rounded" />
            <div className="skeleton h-4 w-72 rounded" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
          </div>
        }
      >
        <AuthForm />
      </Suspense>
    </main>
  )
}
