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
  { name: "Custom Integrations", emoji: "🔌", badge: "Client / Agency", description: "Connect any webhook-based tool." },
  { name: "Meta Ads", emoji: "📢", badge: "Workspace", description: "Pull campaign performance data." },
  { name: "Google Ads", emoji: "🎯", badge: "Workspace", description: "Pull campaign performance data." },
];

type Connected = {
  googleDrive?: boolean;
  notion?: boolean;
  slack?: boolean;
  instantly?: boolean;
};

// Connect / disconnect card for a standard OAuth provider.
function OAuthCard({
  title,
  description,
  connectHref,
  provider,
  connected,
  onChange,
}: {
  title: string;
  description: string;
  connectHref: string;
  provider: string;
  connected: boolean | undefined;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch(`/api/integrations?provider=${provider}`, { method: "DELETE" });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title={title} description={description}>
      <div className="flex items-center justify-between">
        {connected === undefined ? (
          <span className="text-xs text-neutral-500">…</span>
        ) : (
          <Badge>{connected ? "Connected" : "Not connected"}</Badge>
        )}
        {connected ? (
          <button onClick={disconnect} disabled={busy} className={secondaryButtonClass}>
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <a href={connectHref} className={primaryButtonClass}>
            Connect
          </a>
        )}
      </div>
    </SettingsCard>
  );
}

export default function IntegrationsPage() {
  const { project } = useActiveProject();
  const [conn, setConn] = useState<Connected>({});
  const [loaded, setLoaded] = useState(false);
  const [ghlUrl, setGhlUrl] = useState("");
  const [savingGhl, setSavingGhl] = useState(false);
  const [savedGhl, setSavedGhl] = useState(false);
  const [instantlyKey, setInstantlyKey] = useState("");
  const [savingInstantly, setSavingInstantly] = useState(false);

  function loadConnections() {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data: Connected) => {
        setConn(data);
        setLoaded(true);
      });
  }

  useEffect(loadConnections, []);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/context`)
      .then((res) => res.json())
      .then((data: { context?: Record<string, string> }) => setGhlUrl(data.context?.ghl_webhook_url ?? ""));
    // Only refetch when the project actually changes, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

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

  async function saveInstantly() {
    if (!instantlyKey.trim()) return;
    setSavingInstantly(true);
    try {
      const res = await fetch("/api/integrations/instantly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: instantlyKey.trim() }),
      });
      if (res.ok) {
        setInstantlyKey("");
        loadConnections();
      }
    } finally {
      setSavingInstantly(false);
    }
  }

  async function disconnectInstantly() {
    await fetch("/api/integrations?provider=instantly", { method: "DELETE" });
    loadConnections();
  }

  return (
    <SettingsPage title="Integrations" description="Connect the tools agents can read from and act through.">
      <OAuthCard
        title="Google Drive"
        description="Save generated documents straight to Drive."
        connectHref="/api/auth/google"
        provider="google_drive"
        connected={loaded ? !!conn.googleDrive : undefined}
        onChange={loadConnections}
      />

      <SettingsCard
        title="Google Calendar & Gmail"
        description="Read-only. Extends the Google connection above — re-consent to add Calendar and Gmail read access."
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {conn.googleDrive
              ? "Google connected — re-auth to add Calendar + Gmail scopes."
              : "Connect Google Drive first, then re-auth here for the wider scopes."}
          </span>
          <a href="/api/auth/google?scope=expanded" className={primaryButtonClass}>
            Connect Calendar &amp; Gmail
          </a>
        </div>
      </SettingsCard>

      <OAuthCard
        title="Notion"
        description="Search the workspace, read a page, export agent output as a new page."
        connectHref="/api/auth/notion"
        provider="notion"
        connected={loaded ? !!conn.notion : undefined}
        onChange={loadConnections}
      />

      <OAuthCard
        title="Slack"
        description="Post agent activity — like a finished deliverable — to a channel."
        connectHref="/api/auth/slack"
        provider="slack"
        connected={loaded ? !!conn.slack : undefined}
        onChange={loadConnections}
      />

      <SettingsCard title="Instantly" description="API key from your Instantly account settings — pulls campaign stats into reporting.">
        {loaded && conn.instantly ? (
          <div className="flex items-center justify-between">
            <Badge>Connected</Badge>
            <button onClick={disconnectInstantly} className={secondaryButtonClass}>
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <input
              value={instantlyKey}
              onChange={(e) => setInstantlyKey(e.target.value)}
              placeholder="Instantly API key"
              type="password"
              className={inputClass}
            />
            <button onClick={saveInstantly} disabled={savingInstantly || !instantlyKey.trim()} className={primaryButtonClass}>
              {savingInstantly ? "Saving…" : "Save"}
            </button>
          </>
        )}
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
          {savedGhl && <span className="text-xs text-core-green">✓ Saved</span>}
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
