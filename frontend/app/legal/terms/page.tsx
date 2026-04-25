export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-10 dark:bg-dark-bg">
      <article className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 dark:border-dark-border dark:bg-dark-surface">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">Terms of Use</h1>
        <div className="mt-4 space-y-3 text-sm font-sans leading-relaxed text-muted dark:text-gray-400">
          <p>Newsly provides aggregated headlines, summaries, and source links for informational use.</p>
          <p>Content ownership remains with original publishers. Users should visit source links for full context.</p>
          <p>AI-generated summaries and insights may be imperfect and should not be treated as professional advice.</p>
          <p>Users must not misuse the app for unlawful activity or intellectual-property infringement.</p>
        </div>
      </article>
    </main>
  )
}
