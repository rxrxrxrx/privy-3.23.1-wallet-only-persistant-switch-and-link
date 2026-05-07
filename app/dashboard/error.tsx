"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4 text-white font-[family-name:var(--font-geist-mono)]">
        <h1 className="text-xl font-semibold">Dashboard error</h1>
        <p className="text-gray-400 text-sm break-words">
          {error.message || "Something broke while loading your wallets."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-solid border-white/20 hover:border-white/40 transition-colors h-10 px-5 font-medium text-sm"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
