"use client";

import { useEffect, useState } from "react";
import { useActiveProject } from "@/lib/useActiveProject";
import { SettingsPage, SettingsCard, Badge, inputClass, primaryButtonClass, secondaryButtonClass } from "../SettingsUI";

type IntegrationCard = {
  name: string;
  emoji: string;
  badge: "Workspace" | "Client / Agency";
  description: string;
};

const COMING_SOON: IntegrationCard[] = [
  { name: "Notion", emoji: "📓", badge: "Workspace", description: "Sync project docs and notes." },
  { name: "Slack", emoji: "💬", badge: "Client / Agency", description: "Post agent activity to a channel." },
  { name: "Instantly", emoji: "📤", badge: "Client / Agency", description: "Sync cold email campaigns." },
  { name: "Custom Integrations", emoji: "🔌", badge: "Client / Agency", description: "Connect any webhook-based tool." },
  { name: "Meta Ads", emoji: "📢", badge: "Workspace", description: "Pull campaign performance data." },
  { name: "Google Ads", emoji: "🎯", badge: "Workspace", description: "Pull campaign performance data." },
];

export default function IntegrationsPage() {
  const { project } = useActiveProject();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [ghlUrl, setGhlUrl] = useState("");
  const [savingGhl, setSavingGhl] = useState(false);
  const [savedGhl, setSavedGhl] = useState(false);

  function loadDrive() {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data: { googleDrive?: boolean }) => setConnected(!!data.googleDrive));
  }

  useEffect(loadDrive, []);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) => setGhlUrl(data.context?.ghl_webhook_url ?? ""));
  }, [project?.id]);

  async function disconnectDrive() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations?provider=google_drive", { method: "DELETE" });
      loadDrive();
    } finally {
      setDisconnecting(false);
    }
  }

  async function saveGhl() {
    if (!project) return;
    setSavingGhl(true);
    setSavedGhl(false);
    try {
      await fetch(`/api/projects/${project.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: { ghl_webhook_url: ghlUrl } }),
      });
      setSavedGhl(true);
    } finally {
      setSavingGhl(false);
    }
  }

  return (
    <SettingsPage title="Integrations" description="Connect the tools agents can read from and act through.">
      <SettingsCard title="Google Drive" description="Save generated documents straight to Drive.">
        <div className="flex items-center justify-between">
          {connected === null ? (
            <span className="text-xs text-neutral-500">…</span>
          ) : (
            <Badge>{connected ? "Connected" : "Not connected"}</Badge>
          )}
          {connected ? (
            <button onClick={disconnectDrive} disabled={disconnecting} className={secondaryButtonClass}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <a href="/api/auth/google" className={primaryButtonClass}>
              Connect
            </a>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="GoHighLevel" description="Webhook URL for this project — used by Sales Pipeline actions.">
        <input
          value={ghlUrl}
          onChange={(e) => setGhlUrl(e.target.value)}
          placeholder="https://services.leadconnectorhq.com/hooks/…"
          className={inputClass}
        />
        <div className="flex items-center gap-2">
          <button onClick={saveGhl} disabled={savingGhl || !project} className={primaryButtonClass}>
            {savingGhl ? "Saving…" : "Save"}
          </button>
          {savedGhl && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </SettingsCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMING_SOON.map((item) => (
          <div key={item.name} className="rounded-xl border border-white/10 bg-core-card p-4 opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-lg">{item.emoji}</span>
              <Badge>{item.badge}</Badge>
            </div>
            <h3 className="mt-2 text-sm font-medium text-neutral-100">{item.name}</h3>
            <p className="mt-1 text-xs text-neutral-500">{item.description}</p>
            <button disabled className="mt-3 rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-600">
              Coming soon
            </button>
          </div>
        ))}
      </div>
    </SettingsPage>
  );
}
