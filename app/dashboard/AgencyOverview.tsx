"use client";

import { useEffect, useState } from "react";

type Section = { title: string; keys: string[] };

// Mirrors AgencyOSX's Agency Overview grouping.
const SECTIONS: Section[] = [
  { title: "About", keys: ["agency_name", "niche", "positioning", "company_description"] },
  { title: "Public Offer", keys: ["primary_offer", "result_led_mechanism", "pricing"] },
  { title: "Delivery Mechanics", keys: ["delivery_mechanics"] },
  { title: "Commercials", keys: ["commercials"] },
  { title: "Ideal Client", keys: ["ideal_client", "icp"] },
  { title: "Voice and Values", keys: ["voice", "values", "tone"] },
  { title: "Market and Goals", keys: ["market", "goals"] },
  { title: "Web", keys: ["website_url"] },
];

const STAT_KEYS: { key: string; label: string }[] = [
  { key: "niche", label: "Niche" },
  { key: "avg_retainer", label: "Avg Retainer" },
  { key: "market", label: "Market" },
];

function labelFor(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitList(value: string): string[] {
  return value
    .split(/\n|;|,/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" className="shrink-0">
      <path
        d="M4 16l1-4L13 4l3 3-8 8-4 1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Editable brand colour. Clicking opens the OS colour picker; these three
// keys (primary_color / accent_color / background_color) are what every deck
// and document generator reads from the brand kit.
function BrandColorField({
  label,
  value,
  onSet,
  onClear,
}: {
  label: string;
  value?: string;
  onSet: (hex: string) => void;
  onClear: () => void;
}) {
  const valid = !!value && /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <label className="flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-white/10 bg-core-main px-3 py-2 hover:border-core-purple/50">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="flex items-center gap-1.5 text-xs text-neutral-300">
        <span
          className="h-4 w-4 rounded-full border border-white/20"
          style={{ backgroundColor: valid ? value : "transparent" }}
        />
        {valid ? value : <span className="text-neutral-600">not set</span>}
        {valid && (
          <span
            role="button"
            title="Clear"
            onClick={(e) => {
              e.preventDefault();
              onClear();
            }}
            className="ml-1 text-neutral-600 hover:text-core-scarlet"
          >
            ×
          </span>
        )}
      </span>
      <input
        type="color"
        value={valid ? value : "#7c3aed"}
        onChange={(e) => onSet(e.target.value)}
        className="sr-only"
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  editing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSave,
}: {
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-core-card p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        {!editing && (
          <button onClick={onStartEdit} className="text-neutral-500 hover:text-core-purple">
            <EditIcon />
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-1.5">
          <input
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            autoFocus
            className="w-full rounded border border-white/10 bg-core-main px-2 py-1 text-sm text-neutral-100 outline-none focus:border-core-purple"
          />
          <button
            onClick={onSave}
            className="shrink-0 rounded bg-core-purple px-2 py-1 text-xs font-medium text-[#111214] hover:bg-core-purple/80"
          >
            Save
          </button>
        </div>
      ) : (
        <p className="truncate text-sm font-medium text-neutral-100">{value || "—"}</p>
      )}
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

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(context?.[key] ?? "");
  }

  async function saveEdit(key: string) {
    await saveEntry(key, editValue);
    setEditingKey(null);
  }

  async function saveEntry(key: string, value: string) {
    await fetch(`/api/projects/${projectId}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: { [key]: value } }),
    });
    load();
  }

  async function clearEntry(key: string) {
    await fetch(`/api/projects/${projectId}/context?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
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
  const otherKeys = Object.keys(context).filter(
    (k) => !claimedKeys.has(k) && !["company_name", "logo_url", "brand_colours", "tagline", "primary_color", "accent_color", "background_color", "brand_tone", "avg_retainer"].includes(k)
  );
  const allSections = [...SECTIONS, ...(otherKeys.length ? [{ title: "Other", keys: otherKeys }] : [])];

  const agencyName = context.agency_name || context.company_name || projectName;
  const detectedColors = context.brand_colours ? splitList(context.brand_colours) : [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        {context.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.logo_url}
            alt=""
            className="h-14 w-14 rounded-xl border border-white/10 bg-white/5 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-white/10 text-lg text-neutral-600">
            {agencyName.charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-neutral-100">{agencyName}</h2>
          <p className="text-sm text-neutral-500">
            {context.tagline || context.niche || "No tagline set yet"}
          </p>
        </div>
      </div>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_KEYS.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            value={context[stat.key] ?? ""}
            editing={editingKey === stat.key}
            editValue={editValue}
            onEditValueChange={setEditValue}
            onStartEdit={() => startEdit(stat.key)}
            onSave={() => saveEdit(stat.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Brand Identity — its own card since it mixes scan results, colors, and logo upload */}
        <div className="rounded-xl border border-white/10 bg-core-card p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-core-purple">
            Brand Identity
          </h3>
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
                className="shrink-0 rounded-lg bg-core-purple px-3 py-1.5 text-xs font-medium text-[#111214] hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? "Scanning…" : "Scan for brand identity"}
              </button>
            </div>
            {scanError && <p className="text-xs text-core-scarlet">{scanError}</p>}
          </div>

          {context.logo_url && (
            <div className="mb-3">
              <span className="text-xs text-neutral-500">Logo</span>
              <div className="mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={context.logo_url}
                  alt="Logo"
                  className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          <div className="mb-3">
            <span className="text-xs text-neutral-500">Colours</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <BrandColorField
                label="Primary"
                value={context.primary_color}
                onSet={(hex) => saveEntry("primary_color", hex)}
                onClear={() => clearEntry("primary_color")}
              />
              <BrandColorField
                label="Accent"
                value={context.accent_color}
                onSet={(hex) => saveEntry("accent_color", hex)}
                onClear={() => clearEntry("accent_color")}
              />
              <BrandColorField
                label="Background"
                value={context.background_color}
                onSet={(hex) => saveEntry("background_color", hex)}
                onClear={() => clearEntry("background_color")}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-600">
              Applied to every deck and document the agents generate for this client.
            </p>
            {detectedColors.length > 0 && (
              <div className="mt-2">
                <span className="text-[10px] uppercase tracking-wide text-neutral-600">
                  Detected from site scan
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detectedColors.map((hex) => (
                    <span
                      key={hex}
                      className="flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: hex }}
                      />
                      {hex}
                      <span className="ml-1 flex gap-0.5">
                        {(["primary", "accent", "background"] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => saveEntry(`${role}_color`, hex)}
                            title={`Set as ${role}`}
                            className="rounded bg-white/5 px-1 text-[9px] font-medium uppercase text-neutral-400 hover:bg-core-purple/30 hover:text-core-purple"
                          >
                            {role[0]}
                          </button>
                        ))}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">Brand tone</span>
              {editingKey !== "brand_tone" && (
                <button onClick={() => startEdit("brand_tone")} className="text-neutral-500 hover:text-core-purple">
                  <EditIcon />
                </button>
              )}
            </div>
            {editingKey === "brand_tone" ? (
              <div className="mt-1 flex gap-2">
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-white/10 bg-core-main px-2 py-1 text-sm text-neutral-100 outline-none focus:border-core-purple"
                />
                <button
                  onClick={() => saveEdit("brand_tone")}
                  className="rounded bg-core-purple px-2 py-1 text-xs font-medium text-[#111214] hover:bg-core-purple/80"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-200">{context.brand_tone || "Not set"}</p>
            )}
          </div>
        </div>

        {allSections.map((section) => {
          const fields = section.keys.filter((k) => context[k]);

          return (
            <div key={section.title} className="rounded-xl border border-white/10 bg-core-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-core-purple">
                  {section.title}
                </h3>
              </div>

              {fields.length === 0 && <p className="text-sm text-neutral-600">Nothing saved yet.</p>}

              <div className="space-y-3">
                {fields.map((key) => {
                  const isSubsection = key === "positioning" || key === "result_led_mechanism";
                  const isBulletList = key === "delivery_mechanics";
                  const isMarketPills = key === "market" && section.title === "Market and Goals";
                  const isWebsiteLink = key === "website_url";

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs ${
                            isSubsection ? "font-semibold uppercase tracking-wide text-core-purple" : "text-neutral-500"
                          }`}
                        >
                          {isSubsection
                            ? key === "positioning"
                              ? "Positioning"
                              : "Result-Led Mechanism"
                            : labelFor(key)}
                        </span>
                        {editingKey !== key && (
                          <button onClick={() => startEdit(key)} className="text-neutral-500 hover:text-core-purple">
                            <EditIcon />
                          </button>
                        )}
                      </div>
                      {editingKey === key ? (
                        <div className="mt-1 flex gap-2">
                          {isBulletList ? (
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              rows={3}
                              placeholder="One item per line"
                              className="w-full rounded border border-white/10 bg-core-main px-2 py-1 text-sm text-neutral-100 outline-none focus:border-core-purple"
                            />
                          ) : (
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              className="w-full rounded border border-white/10 bg-core-main px-2 py-1 text-sm text-neutral-100 outline-none focus:border-core-purple"
                            />
                          )}
                          <button
                            onClick={() => saveEdit(key)}
                            className="shrink-0 rounded bg-core-purple px-2 py-1 text-xs font-medium text-[#111214] hover:bg-core-purple/80"
                          >
                            Save
                          </button>
                        </div>
                      ) : isBulletList ? (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-neutral-200">
                          {splitList(context[key]).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : isMarketPills ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {splitList(context[key]).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-core-purple/15 px-2.5 py-0.5 text-xs text-core-purple"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : isWebsiteLink ? (
                        <a
                          href={context[key].startsWith("http") ? context[key] : `https://${context[key]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-core-purple hover:underline"
                        >
                          {context[key]}
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-neutral-200">{context[key]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
