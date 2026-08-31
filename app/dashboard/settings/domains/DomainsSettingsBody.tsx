"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveProject } from "@/lib/useActiveProject";
import type { ClientDomain } from "@/lib/domains";
import {
  SettingsCard,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../SettingsUI";

const STATUS_TONE: Record<ClientDomain["verification_status"], string> = {
  pending: "text-neutral-400",
  verified: "text-core-green",
  failed: "text-core-scarlet",
};
export function DomainsSettingsBody() {
  const { project } = useActiveProject();
  const projectId = project?.id ?? null;

  const [domains, setDomains] = useState<ClientDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/clients/${projectId}/domains`)
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  async function add() {
    if (!projectId || !newDomain.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${projectId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Couldn't add that domain");
        return;
      }
      setNewDomain("");
      load();
    } finally {
      setAdding(false);
    }
  }

  async function verify(id: string, method: "dns_txt" | "file_upload") {
    if (!projectId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${projectId}/domains/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!projectId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${projectId}/domains/${id}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  if (!projectId) {
    return <p className="text-sm text-neutral-500">Select a client from the dashboard first.</p>;
  }
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <SettingsCard title="Connected domains" description="Add a domain, then prove control via DNS or a file.">
      {domains.length === 0 && <p className="text-sm text-neutral-500">No domains added yet.</p>}

      <div className="space-y-2">
        {domains.map((d) => {
          const showHelp = d.verification_status !== "verified";
          const open = expanded === d.id;
          return (
            <div key={d.id} className="rounded-lg border border-white/5 bg-core-main p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-neutral-100">{d.domain}</span>
                <span className={`text-xs font-medium ${STATUS_TONE[d.verification_status]}`}>
                  {d.verification_status}
                </span>
                {d.connected && <span className="text-xs text-core-green">● connected</span>}
                <span className="flex-1" />
                {showHelp && (
                  <button
                    onClick={() => setExpanded(open ? null : d.id)}
                    className="rounded border border-white/10 px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/5"
                  >
                    {open ? "Hide" : "How to verify"}
                  </button>
                )}
                <button
                  onClick={() => remove(d.id)}
                  disabled={busyId === d.id}
                  className="rounded border border-core-scarlet/40 px-2 py-0.5 text-xs text-core-scarlet hover:bg-core-scarlet/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>

              {showHelp && open && (
                <div className="mt-3 space-y-4 border-t border-white/10 pt-3 text-xs text-neutral-400">
                  <div>
                    <p className="mb-1 font-medium text-neutral-300">Option A — DNS TXT record</p>
                    <p>Add this TXT record at your DNS provider, then verify:</p>
                    <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-neutral-200">
{`_coreos-verify.${d.domain}   TXT   ${d.verification_token}`}
                    </pre>
                    <button
                      onClick={() => verify(d.id, "dns_txt")}
                      disabled={busyId === d.id}
                      className={`${secondaryButtonClass} mt-2`}
                    >
                      {busyId === d.id ? "Checking…" : "Verify via DNS"}
                    </button>
                  </div>
                  <div>
                    <p className="mb-1 font-medium text-neutral-300">Option B — file upload</p>
                    <p>
                      Upload a file at{" "}
                      <code className="rounded bg-black/30 px-1">
                        https://{d.domain}/.well-known/coreos-verify.txt
                      </code>{" "}
                      containing exactly:
                    </p>
                    <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-neutral-200">
{d.verification_token}
                    </pre>
                    <button
                      onClick={() => verify(d.id, "file_upload")}
                      disabled={busyId === d.id}
                      className={`${secondaryButtonClass} mt-2`}
                    >
                      {busyId === d.id ? "Checking…" : "Verify via file"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-3">
        <input
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="clientdomain.com"
          className={inputClass}
        />
        <button onClick={add} disabled={adding || !newDomain.trim()} className={primaryButtonClass}>
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-core-scarlet">{error}</p>}
    </SettingsCard>
  );
}
