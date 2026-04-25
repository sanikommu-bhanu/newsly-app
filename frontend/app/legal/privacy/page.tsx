export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-10 dark:bg-dark-bg">
      <article className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 dark:border-dark-border dark:bg-dark-surface">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">Privacy Policy</h1>
        <div className="mt-4 space-y-3 text-sm font-sans leading-relaxed text-muted dark:text-gray-400">
          <p>Newsly stores account and preference data needed to personalize your feed.</p>
          <p>Saved bookmarks, alert toggles, and UI preferences are stored on your device for app continuity.</p>
          <p>We do not claim ownership of source publisher content and only display excerpts with attribution.</p>
          <p>For production use, add your operator contact details and jurisdiction-specific disclosures.</p>
        </div>
      </article>
    </main>
  )
}
