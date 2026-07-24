/**
 * SD-9: Скелетон загрузки страницы SessionDetail.
 */
import { Skeleton } from "@/components/ui/skeleton";

export function SessionLoadingSkeleton() {
  return (
    <div className="space-y-5">
      {/* Back link */}
      <Skeleton className="h-4 w-24" />

      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Skeleton className="h-9 w-72" />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-10 w-full rounded-none" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-border/40" />
        ))}
      </div>
    </div>
  );
}
