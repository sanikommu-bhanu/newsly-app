import Link from 'next/link'

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-10 dark:bg-dark-bg">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 dark:border-dark-border dark:bg-dark-surface">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">Legal Center</h1>
        <p className="mt-3 text-sm font-sans text-muted dark:text-gray-400">
          Newsly aggregates headlines and links to original sources. Full article rights remain with
          the publishers. This page is product guidance, not legal advice.
        </p>
        <div className="mt-5 space-y-2 text-sm font-sans">
          <Link href="/legal/terms" className="block rounded-xl border border-border px-4 py-3 hover:bg-gray-50 dark:border-dark-border dark:hover:bg-dark-bg">
            Terms of Use
          </Link>
          <Link href="/legal/privacy" className="block rounded-xl border border-border px-4 py-3 hover:bg-gray-50 dark:border-dark-border dark:hover:bg-dark-bg">
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  )
}
