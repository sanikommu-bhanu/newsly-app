export default function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl overflow-hidden shadow-card">
      {/* Image placeholder */}
      <div className="aspect-video skeleton" />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category pill */}
        <div className="skeleton h-4 w-20 rounded-full" />

        {/* Title — 2 lines */}
        <div className="space-y-2">
          <div className="skeleton h-[18px] w-full rounded" />
          <div className="skeleton h-[18px] w-4/5 rounded" />
        </div>

        {/* Description — 2 lines */}
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-full rounded" />
          <div className="skeleton h-3.5 w-3/4 rounded" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
