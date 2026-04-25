import { cn } from '@/lib/utils'

type NewslyLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showWordmark?: boolean
}

const SIZE_MAP = {
  sm: {
    shell: 'w-9 h-9 rounded-xl',
    inner: 'rounded-[10px] text-lg',
    wordmark: 'text-lg',
  },
  md: {
    shell: 'w-12 h-12 rounded-2xl',
    inner: 'rounded-[14px] text-2xl',
    wordmark: 'text-2xl',
  },
  lg: {
    shell: 'w-16 h-16 rounded-3xl',
    inner: 'rounded-[20px] text-[2rem]',
    wordmark: 'text-[2rem]',
  },
} as const

export default function NewslyLogo({
  size = 'md',
  className,
  showWordmark = false,
}: NewslyLogoProps) {
  const styles = SIZE_MAP[size]

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <span
        className={cn(
          'relative inline-flex p-[2px] bg-[conic-gradient(at_20%_15%,#1D4ED8,#0284C7,#14B8A6,#1D4ED8)] shadow-[0_10px_24px_rgba(37,99,235,0.35)]',
          styles.shell
        )}
      >
        <span
          className={cn(
            'relative flex h-full w-full items-center justify-center bg-[#0F172A] font-display font-semibold text-white',
            styles.inner
          )}
          aria-hidden="true"
        >
          N
        </span>
        <span
          className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border border-white/60 bg-emerald-400"
          aria-hidden="true"
        />
      </span>

      {showWordmark ? (
        <span
          className={cn(
            'font-display font-semibold tracking-tight text-ink dark:text-white',
            styles.wordmark
          )}
        >
          Newsly
        </span>
      ) : null}
    </div>
  )
}