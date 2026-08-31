"use client";

import Link from "next/link";
import type { Project } from "@/lib/projects";

const STATUS_TONE: Record<string, string> = {
  lead: "text-sky-400",
  onboarding: "text-amber-400",
  active: "text-emerald-400",
  paused: "text-neutral-400",
  churned: "text-red-400",
};

export default function ClientsView({
  projects,
  activeProjectId,
  onOpen,
}: {
  projects: Project[];
  activeProjectId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Clients</h2>
        <Link
          href="/dashboard/clients/new"
          className="rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-white hover:bg-core-purple/80"
        >
          + Add client
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-core-card/50 p-10 text-center">
          <div className="mb-2 text-2xl">👥</div>
          <h3 className="font-medium text-neutral-200">No clients yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Add your first client to get started.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-core-card">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onOpen(p.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-100">
                    {p.name}
                    {p.id === activeProjectId && (
                      <span className="ml-2 text-xs text-core-purple">active</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {p.industry ?? "—"}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${STATUS_TONE[p.status] ?? "text-neutral-400"}`}
                >
                  {p.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
