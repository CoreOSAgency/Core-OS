"use client";

import { useEffect, useState } from "react";

export default function ProjectMemoryPanel({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [context, setContext] = useState<Record<string, string> | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function load() {
    fetch(`/api/projects/${projectId}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) =>
        setContext(data.context ?? {})
      );
  }

  useEffect(load, [projectId]);

  async function saveEdit(key: string) {
    await fetch(`/api/projects/${projectId}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: { [key]: editValue } }),
    });
    setEditingKey(null);
    load();
  }

  async function deleteEntry(key: string) {
    await fetch(`/api/projects/${projectId}/context?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    load();
  }

  const entries = context ? Object.entries(context) : [];

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="font-semibold text-neutral-100">Project Memory</h2>
            <p className="text-xs text-neutral-400">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {context === null && (
            <p className="text-sm text-neutral-500">Loading…</p>
          )}
          {context !== null && entries.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nothing saved yet. Facts agents learn about this project will
              show up here.
            </p>
          )}

          {entries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {key}
                </span>
                <div className="flex gap-1">
                  {editingKey !== key && (
                    <button
                      onClick={() => {
                        setEditingKey(key);
                        setEditValue(value);
                      }}
                      className="text-xs text-neutral-400 hover:text-emerald-400"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => deleteEntry(key)}
                    className="text-xs text-neutral-400 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingKey === key ? (
                <div className="mt-2 flex gap-2">
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => saveEdit(key)}
                    className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-neutral-950 hover:bg-emerald-400"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-sm text-neutral-200">{value}</p>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
