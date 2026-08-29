export function SettingsPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-lg font-semibold text-neutral-100">{title}</h1>
      {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-core-card p-5">
      <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
      {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple";

export const primaryButtonClass =
  "rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-white hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
      {children}
    </span>
  );
}
