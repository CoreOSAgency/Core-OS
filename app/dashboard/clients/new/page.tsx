"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVE_PROJECT_KEY } from "@/lib/localStorageKeys";
import type { BillingFrequency } from "@/lib/billing";

const STEPS = ["Basics", "Brand", "Commercials", "Review"];

const input =
  "w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple";
const label = "mb-1 block text-xs text-neutral-500";

type Extracted = {
  company_name?: string;
  company_description?: string;
  tagline?: string;
  logo_url?: string;
  brand_colours?: string;
};

export default function NewClientPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — basics
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Step 2 — brand
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");

  // Step 3 — commercials
  const [retainer, setRetainer] = useState("");
  const [frequency, setFrequency] = useState<BillingFrequency | "">("monthly");
  const [startDate, setStartDate] = useState("");

  async function scanWebsite() {
    if (!websiteUrl.trim()) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't read that site");
      const ex: Extracted = data.extracted ?? {};
      if (ex.logo_url) setLogoUrl(ex.logo_url);
      if (ex.tagline) setBrandTone((t) => t || ex.tagline!);
      const colours = (ex.brand_colours ?? "").split(",").map((c) => c.trim()).filter(Boolean);
      if (colours[0]) setPrimaryColor((c) => c || colours[0]);
      if (colours[1]) setAccentColor((c) => c || colours[1]);
      setScanned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || undefined,
          website_url: websiteUrl.trim() || undefined,
          primary_contact_name: contactName.trim() || undefined,
          primary_contact_email: contactEmail.trim() || undefined,
          status: "onboarding",
        }),
      });
      const projectData = await projectRes.json();
      if (!projectRes.ok || !projectData.project) {
        throw new Error(projectData?.error ?? "Couldn't create the client");
      }
      const id: string = projectData.project.id;

      const entries: Record<string, string> = {};
      if (industry.trim()) entries.niche = industry.trim();
      if (websiteUrl.trim()) entries.website_url = websiteUrl.trim();
      if (logoUrl.trim()) entries.logo_url = logoUrl.trim();
      if (brandTone.trim()) entries.brand_tone = brandTone.trim();
      if (primaryColor.trim()) entries.primary_color = primaryColor.trim();
      if (accentColor.trim()) entries.accent_color = accentColor.trim();
      if (Object.keys(entries).length > 0) {
        await fetch(`/api/projects/${id}/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
      }

      if (retainer.trim() && frequency) {
        await fetch(`/api/clients/${id}/billing`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            retainer_amount: Number(retainer),
            billing_frequency: frequency,
            billing_start_date: startDate || null,
            currency: "USD",
          }),
        });
      }

      try {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      } catch {
        // per-browser convenience only
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  const canNext =
    step === 0 ? name.trim().length > 0 : true;

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else create();
  }

  return (
    <div className="min-h-screen bg-core-main text-neutral-100">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <span className="text-sm font-semibold">New client</span>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-neutral-100">
          Cancel
        </Link>
      </header>

      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  i <= step ? "bg-core-purple text-[#04170d]" : "bg-white/5 text-neutral-500"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${i === step ? "text-neutral-200" : "text-neutral-600"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-core-card p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className={label}>Client name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={input} />
              </div>
              <div>
                <label className={label}>Industry / niche</label>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Website URL</label>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="acme.com"
                  className={input}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Primary contact</label>
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={input} />
                </div>
                <div>
                  <label className={label}>Contact email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={input}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-400">
                {websiteUrl.trim()
                  ? "Pull brand details from the client's site, then review before saving."
                  : "No website URL — enter brand details manually, or skip."}
              </p>
              {websiteUrl.trim() && (
                <button
                  onClick={scanWebsite}
                  disabled={scanning}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
                >
                  {scanning ? "Scanning…" : scanned ? "Re-scan site" : "Scan website"}
                </button>
              )}
              <div>
                <label className={label}>Logo URL</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label}>Brand tone</label>
                <input
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  placeholder="e.g. confident, direct-response"
                  className={input}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Primary color</label>
                  <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#7c3aed" className={input} />
                </div>
                <div>
                  <label className={label}>Accent color</label>
                  <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#6366f1" className={input} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-400">The retainer agreement. Skip if not set yet.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Retainer amount (USD)</label>
                  <input
                    type="number"
                    min="0"
                    value={retainer}
                    onChange={(e) => setRetainer(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as BillingFrequency | "")}
                    className={input}
                  >
                    <option value="">—</option>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="one_time">One-time</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
              </div>
            </div>
          )}

          {step === 3 && (
            <dl className="space-y-2 text-sm">
              <Row k="Name" v={name} />
              <Row k="Industry" v={industry} />
              <Row k="Website" v={websiteUrl} />
              <Row k="Contact" v={[contactName, contactEmail].filter(Boolean).join(" · ")} />
              <Row k="Brand tone" v={brandTone} />
              <Row k="Colors" v={[primaryColor, accentColor].filter(Boolean).join(" / ")} />
              <Row
                k="Retainer"
                v={retainer && frequency ? `$${retainer} ${frequency}` : "—"}
              />
              <p className="pt-2 text-xs text-neutral-500">
                Creates the client with status <span className="text-neutral-300">onboarding</span>. Everything
                stays editable from settings afterward.
              </p>
            </dl>
          )}

          {error && <p className="mt-4 text-sm text-core-scarlet">{error}</p>}

          <div className="mt-6 flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={creating}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              disabled={!canNext || creating}
              className="ml-auto rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-[#04170d] hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? "Creating…"
                : step === STEPS.length - 1
                  ? "Create client"
                  : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-1.5">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-right text-neutral-200">{v || "—"}</dd>
    </div>
  );
}
