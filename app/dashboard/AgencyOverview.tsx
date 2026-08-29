"use client";

import { useEffect, useState } from "react";

type Section = { title: string; keys: string[] };

// Mirrors AgencyOSX's Agency Overview grouping. "Voice and Values" has no
// dedicated keys today — it's here so the section exists once agents start
// saving tone/voice facts, same as the others.
const SECTIONS: Section[] = [
  { title: "Brand Identity", keys: ["company_name", "logo_url", "brand_colours", "tagline"] },
  { title: "About", keys: ["agency_name", "niche", "company_description", "website_url"] },
  { title: "Public Offer", keys: ["primary_offer", "pricing"] },
  { title: "Ideal Client", keys: ["ideal_client", "icp"] },
  { title: "Voice and Values", keys: ["voice", "values", "tone"] },
  { title: "Market and Goals", keys: ["market", "goals"] },
];

function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AgencyOverview({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [context, setContext] = useState<Record<string, string> | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function load() {
    fetch(`/api/projects/${projectId}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) => setContext(data.context ?? {}));
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

  if (context === null) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  const claimedKeys = new Set(SECTIONS.flatMap((s) => s.keys));
  const otherKeys = Object.keys(context).filter((k) => !claimedKeys.has(k));
  const allSections = [...SECTIONS, ...(otherKeys.length ? [{ title: "Other", keys: otherKeys }] : [])];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-neutral-100">Agency Overview</h2>
      <p className="mb-6 text-sm text-neutral-500">{projectName}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {allSections.map((section) => {
          const fields = section.keys.filter((k) => context[k]);
          return (
            <div
              key={section.title}
              className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-400">
                {section.title}
              </h3>

              {fields.length === 0 && (
                <p className="text-sm text-neutral-600">Nothing saved yet.</p>
              )}

              <div className="space-y-3">
                {fields.map((key) => (
                  <div key={key}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">{labelFor(key)}</span>
                      {editingKey !== key && (
                        <button
                          onClick={() => {
                            setEditingKey(key);
                            setEditValue(context[key]);
                          }}
                          className="text-xs text-neutral-500 hover:text-emerald-400"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingKey === key ? (
                      <div className="mt-1 flex gap-2">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100 outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => saveEdit(key)}
                          className="rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-neutral-950 hover:bg-emerald-400"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-200">{context[key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
