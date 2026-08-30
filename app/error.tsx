"use client";

// Next's built-in error-boundary convention — no hand-rolled class component needed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
      <div className="max-w-md text-center">
        <div className="mb-4 text-4xl">⚠️</div>
        <h2 className="mb-2 text-lg font-bold text-neutral-100">Something went wrong</h2>
        <p className="mb-6 text-sm text-neutral-500">
          An unexpected error occurred. This has been logged.
        </p>
        <details className="mb-6 rounded-lg border border-white/10 bg-core-card p-3 text-left">
          <summary className="cursor-pointer text-xs text-neutral-500">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-400">
            {error.message}
          </pre>
        </details>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-white/15"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-core-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-core-purple/80"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
