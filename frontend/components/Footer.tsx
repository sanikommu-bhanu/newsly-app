import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'px-5 py-4 border-t border-border dark:border-dark-border',
        className
      )}
    >
      <p className="text-[11px] font-sans text-gray-400 dark:text-gray-600 leading-relaxed text-center">
        Headlines, snippets, and images belong to their publishers. Newsly shows excerpts and links to original sources. AI insights may be imperfect.
      </p>
      <div className="mt-2 flex justify-center gap-3 text-[11px] font-sans">
        <Link href="/legal" className="text-muted hover:underline dark:text-gray-500">
          Legal
        </Link>
        <Link href="/legal/privacy" className="text-muted hover:underline dark:text-gray-500">
          Privacy
        </Link>
        <Link href="/legal/terms" className="text-muted hover:underline dark:text-gray-500">
          Terms
        </Link>
      </div>
    </footer>
  )
}
