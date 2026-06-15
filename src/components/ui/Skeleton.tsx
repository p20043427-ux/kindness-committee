export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`motion-safe:animate-pulse bg-surface-200 rounded ${className}`} />
  );
}

export function SkeletonTableRows({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-surface-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="py-3 px-4">
              <Skeleton className={`h-4 ${j === 0 ? "w-24" : j === 1 ? "w-20" : j === cols - 1 ? "w-12" : "w-full"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="p-3 rounded-lg border border-surface-200 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      {lines > 1 && <Skeleton className="h-3 w-1/3" />}
    </div>
  );
}

export function SkeletonBuildingCard() {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 bg-white flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
