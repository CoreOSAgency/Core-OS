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

function ColorSwatches({ value }: { value: string }) {
  const colors = value.split(",").map((c) => c.trim()).filter(Boolean);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(hex: string) {
    navigator.clipboard?.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((hex) => (
        <button
          key={hex}
          onClick={() => copy(hex)}
          title="Click to copy"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-core-main px-2 py-1 text-xs text-neutral-300 hover:border-core-purple/50"
        >
          <span
            className="h-4 w-4 rounded-full border border-white/20"
            style={{ backgroundColor: /^#[0-9a-fA-F]{3,6}$/.test(hex) ? hex : "transparent" }}
          />
          {copied === hex ? "Copied!" : hex}
        </button>
      ))}
    </div>
  );
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
  const [scanUrl, setScanUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  function load() {
    fetch(`/api/projects/${projectId}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) => {
        const ctx = data.context ?? {};
        setContext(ctx);
        setScanUrl((prev) => prev || ctx.website_url || "");
      });
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

  async function scanForBrandIdentity() {
    const url = scanUrl.trim();
    if (!url) return;
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't scan that site");
      load();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Couldn't scan that site");
    } finally {
      setScanning(false);
    }
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
          const isBrandIdentity = section.title === "Brand Identity";

          return (
            <div
              key={section.title}
              className="rounded-xl border border-white/10 bg-core-card p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-core-purple">
                  {section.title}
                </h3>
              </div>

              {isBrandIdentity && (
                <div className="mb-4 space-y-2 rounded-lg border border-white/10 bg-core-main p-3">
                  <p className="text-xs text-neutral-500">
                    Scan a website to pull logo, brand colors, name, and tagline automatically.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={scanUrl}
                      onChange={(e) => setScanUrl(e.target.value)}
                      placeholder="https://youragency.com"
                      className="w-full rounded-lg border border-white/10 bg-core-card px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-core-purple"
                    />
                    <button
                      onClick={scanForBrandIdentity}
                      disabled={scanning || !scanUrl.trim()}
                      className="shrink-0 rounded-lg bg-core-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {scanning ? "Scanning…" : "Scan for brand identity"}
                    </button>
                  </div>
                  {scanError && <p className="text-xs text-red-400">{scanError}</p>}
                </div>
              )}

              {fields.length === 0 && (
                <p className="text-sm text-neutral-600">Nothing saved yet.</p>
              )}

              <div className="space-y-3">
                {fields.map((key) => (
                  <div key={key}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">{labelFor(key)}</span>
                      {editingKey !== key && key !== "logo_url" && (
                        <button
                          onClick={() => {
                            setEditingKey(key);
                            setEditValue(context[key]);
                          }}
                          className="text-xs text-neutral-500 hover:text-core-purple"
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
                          className="w-full rounded border border-white/10 bg-core-main px-2 py-1 text-sm text-neutral-100 outline-none focus:border-core-purple"
                        />
                        <button
                          onClick={() => saveEdit(key)}
                          className="rounded bg-core-purple px-2 py-1 text-xs font-medium text-white hover:bg-core-purple/80"
                        >
                          Save
                        </button>
                      </div>
                    ) : key === "logo_url" ? (
                      <div className="mt-1 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={context[key]}
                          alt="Logo"
                          className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <button
                          onClick={() => {
                            setEditingKey(key);
                            setEditValue(context[key]);
                          }}
                          className="text-xs text-neutral-500 hover:text-core-purple"
                        >
                          Edit
                        </button>
                      </div>
                    ) : key === "brand_colours" ? (
                      <div className="mt-1">
                        <ColorSwatches value={context[key]} />
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
