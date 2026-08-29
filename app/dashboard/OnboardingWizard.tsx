"use client";

import { useState } from "react";
import type { Project } from "@/lib/projects";

const STEPS = ["Agency", "Offer", "Market & Goals", "Integrations"];

export default function OnboardingWizard({
  onComplete,
}: {
  onComplete: (project: Project) => void;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [agencyName, setAgencyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [niche, setNiche] = useState("");
  const [primaryOffer, setPrimaryOffer] = useState("");
  const [pricing, setPricing] = useState("");
  const [idealClient, setIdealClient] = useState("");
  const [market, setMarket] = useState("");
  const [goals, setGoals] = useState("");
  const [ghlWebhookUrl, setGhlWebhookUrl] = useState("");
  const [driveFolderUrl, setDriveFolderUrl] = useState("");

  async function finish() {
    setSubmitting(true);
    try {
      const projectRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: agencyName.trim(), description: niche.trim() }),
      });
      const projectData = await projectRes.json();
      if (!projectRes.ok || !projectData.project) {
        throw new Error(projectData.error ?? "Couldn't create project");
      }
      const project: Project = projectData.project;

      if (websiteUrl.trim()) {
        await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: websiteUrl.trim(), projectId: project.id }),
        }).catch(() => {
          // Import is best-effort — a bad URL shouldn't block onboarding.
        });
      }

      const driveFolderMatch = driveFolderUrl.trim().match(/\/folders\/([a-zA-Z0-9_-]+)/);
      const driveFolderId = driveFolderMatch
        ? driveFolderMatch[1]
        : /^[a-zA-Z0-9_-]{10,}$/.test(driveFolderUrl.trim())
          ? driveFolderUrl.trim()
          : "";

      await fetch(`/api/projects/${project.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: {
            niche,
            primary_offer: primaryOffer,
            pricing,
            ideal_client: idealClient,
            market,
            goals,
            ghl_webhook_url: ghlWebhookUrl,
            google_drive_folder_id: driveFolderId,
          },
        }),
      });

      onComplete(project);
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500";

  return (
    <div className="mx-auto max-w-md rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                i <= step ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800 text-neutral-500"
              }`}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${i < step ? "bg-emerald-500" : "bg-neutral-800"}`} />
            )}
          </div>
        ))}
      </div>

      <h2 className="font-semibold text-neutral-100">
        Set up your agency — {STEPS[step]}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        This becomes the context every agent already knows about your business.
      </p>

      <div className="mt-4 space-y-3">
        {step === 0 && (
          <>
            <input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Agency name"
              required
              autoFocus
              className={inputClass}
            />
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="Website URL (optional) — we'll import your brand"
              className={inputClass}
            />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Niche (e.g. outbound appointment setting for coaches)"
              className={inputClass}
            />
          </>
        )}

        {step === 1 && (
          <>
            <textarea
              value={primaryOffer}
              onChange={(e) => setPrimaryOffer(e.target.value)}
              placeholder="Your primary offer"
              rows={2}
              className={inputClass}
            />
            <input
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              placeholder="Pricing (e.g. $2,997/mo, 90-day minimum)"
              className={inputClass}
            />
            <textarea
              value={idealClient}
              onChange={(e) => setIdealClient(e.target.value)}
              placeholder="Ideal client description"
              rows={2}
              className={inputClass}
            />
          </>
        )}

        {step === 2 && (
          <>
            <input
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              placeholder="Market (e.g. US, UK)"
              className={inputClass}
            />
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Your goals for this agency right now"
              rows={3}
              className={inputClass}
            />
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                GoHighLevel webhook URL (optional)
              </label>
              <input
                value={ghlWebhookUrl}
                onChange={(e) => setGhlWebhookUrl(e.target.value)}
                placeholder="https://services.leadconnectorhq.com/hooks/…"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                Google Drive folder URL (optional) — save generated docs here
              </label>
              <input
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-600">
                Connect Google Drive itself from the Integrations menu first.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={submitting}
            className="rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={submitting || (step === 0 && !agencyName.trim())}
          className="ml-auto rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Setting up…" : step === STEPS.length - 1 ? "Finish setup" : "Next"}
        </button>
      </div>
    </div>
  );
}
