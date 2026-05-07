export function DashboardSkeleton() {
  return (
    <div
      className="min-h-screen text-white font-[family-name:var(--font-geist-mono)]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-72 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-gray-800 rounded-full animate-pulse" />
        </div>

        <div className="bg-gray-900 border-2 border-gray-800 rounded-lg p-6 space-y-4">
          <div className="h-6 w-40 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-80 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-800 rounded animate-pulse" />
        </div>

        <div className="space-y-4">
          <div className="h-7 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 bg-gray-900 border border-gray-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
