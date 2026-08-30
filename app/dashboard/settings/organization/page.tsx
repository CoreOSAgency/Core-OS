"use client";

import { useEffect, useState } from "react";
import { useActiveProject } from "@/lib/useActiveProject";
import { SettingsPage, SettingsCard, inputClass, primaryButtonClass, secondaryButtonClass } from "../SettingsUI";

const PRESET_COLORS = ["#7c3aed", "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#0a0a0f"];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#7c3aed"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      </div>
      <div className="mt-2 flex gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className="h-5 w-5 rounded-full border border-white/20"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

export default function OrganizationPage() {
  const { project, loading, refresh } = useActiveProject();
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7c3aed");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [backgroundColor, setBackgroundColor] = useState("#0d0d18");
  const [brandTone, setBrandTone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    fetch(`/api/projects/${project.id}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) => {
        const ctx = data.context ?? {};
        setNiche(ctx.niche ?? "");
        setWebsiteUrl(ctx.website_url ?? "");
        setPrimaryColor(ctx.primary_color ?? "#7c3aed");
        setAccentColor(ctx.accent_color ?? "#6366f1");
        setBackgroundColor(ctx.background_color ?? "#0d0d18");
        setBrandTone(ctx.brand_tone ?? "");
        setLogoUrl(ctx.logo_url ?? "");
      });
    // Only refetch when the project actually changes, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function save() {
    if (!project) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await fetch(`/api/projects/${project.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: {
            niche,
            website_url: websiteUrl,
            primary_color: primaryColor,
            accent_color: accentColor,
            background_color: backgroundColor,
            brand_tone: brandTone,
          },
        }),
      });
      setSaved(true);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function detectFromWebsite() {
    if (!project || !websiteUrl.trim()) return;
    setDetecting(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim(), projectId: project.id }),
      });
      const data = await res.json();
      if (res.ok && data.extracted) {
        if (data.extracted.logo_url) setLogoUrl(data.extracted.logo_url);
        if (data.extracted.tagline) setBrandTone((t) => t || data.extracted.tagline);
      }
    } finally {
      setDetecting(false);
    }
  }

  if (loading) return <SettingsPage title="Organization"><p className="text-sm text-neutral-500">Loading…</p></SettingsPage>;
  if (!project) return <SettingsPage title="Organization"><p className="text-sm text-neutral-500">Create a project from the dashboard first.</p></SettingsPage>;

  return (
    <SettingsPage title="Organization" description="How agents introduce your agency and its brand.">
      <SettingsCard title="Agency Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </SettingsCard>

      <SettingsCard title="Agency Details">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Industry / niche</label>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Website</label>
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </SettingsCard>

      <SettingsCard title="Brand Kit" description="Visual identity used when agents generate documents and decks.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorField label="Primary color" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Accent color" value={accentColor} onChange={setAccentColor} />
          <ColorField label="Background color" value={backgroundColor} onChange={setBackgroundColor} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Brand tone</label>
          <input
            value={brandTone}
            onChange={(e) => setBrandTone(e.target.value)}
            placeholder="e.g. confident, no-fluff, direct-response"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-500">Logo</label>
          <div className="flex items-center gap-3">
            {logoFile || logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoFile ?? logoUrl} alt="Logo" className="h-12 w-12 rounded-lg border border-white/10 object-contain bg-white/5" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-neutral-600">
                None
              </div>
            )}
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              Replace
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setLogoFile(URL.createObjectURL(file));
                }}
              />
            </label>
            {(logoFile || logoUrl) && (
              <button
                onClick={() => {
                  setLogoFile(null);
                  setLogoUrl("");
                }}
                className={secondaryButtonClass}
              >
                Remove
              </button>
            )}
            <button onClick={detectFromWebsite} disabled={detecting || !websiteUrl.trim()} className={secondaryButtonClass}>
              {detecting ? "Detecting…" : "Detect from website"}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            {/* ponytail: no file storage bucket wired up — an uploaded replacement previews locally but won't persist across reloads. "Detect from website" pulls a real logo URL and saves it. */}
            Uploaded replacements preview locally only — wire up storage to persist them.
          </p>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
