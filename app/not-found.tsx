import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-core-main p-6">
      <div className="max-w-md text-center">
        <div className="mb-4 text-4xl">🧭</div>
        <h2 className="mb-2 text-lg font-bold text-neutral-100">Page not found</h2>
        <p className="mb-6 text-sm text-neutral-500">
          This page doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-core-purple px-4 py-2.5 text-sm font-semibold text-[#04170d] hover:bg-core-purple/80"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
