"use client";

import { SettingsPage, SettingsCard, primaryButtonClass } from "../SettingsUI";

export default function ApiAccessPage() {
  return (
    <SettingsPage title="API Access">
      <SettingsCard title="API Tokens">
        <div className="flex justify-end">
          <button disabled title="Token issuance isn't wired up yet" className={primaryButtonClass}>
            Generate Token
          </button>
        </div>
        <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
          <p className="text-sm text-neutral-400">No tokens yet.</p>
          <a
            href="https://github.com/CoreOSAgency/Core-OS"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-core-purple hover:underline"
          >
            View API Documentation →
          </a>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
