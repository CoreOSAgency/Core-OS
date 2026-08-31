"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveProject } from "@/lib/useActiveProject";
import { downloadFileFromResponse } from "@/lib/download";
import type { AgencyReport, ClientReport } from "@/lib/reports";
import {
  SettingsPage,
  SettingsCard,
  primaryButtonClass,
  secondaryButtonClass,
} from "../SettingsUI";

function money(n: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"client" | "agency">("client");
  return (
    <SettingsPage
      title="Reports"
      description="Client and agency performance, pulled live from billing."
    >
      <div className="flex gap-2">
        <button
          onClick={() => setTab("client")}
          className={tab === "client" ? primaryButtonClass : secondaryButtonClass}
        >
          This client
        </button>
        <button
          onClick={() => setTab("agency")}
          className={tab === "agency" ? primaryButtonClass : secondaryButtonClass}
        >
          Agency-wide
        </button>
      </div>
      {tab === "client" ? <ClientReportView /> : <AgencyReportView />}
    </SettingsPage>
  );
}

function Stat({ label, value, tone = "text-neutral-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-core-card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function ClientReportView() {
  const { project } = useActiveProject();
  const projectId = project?.id ?? null;
  const [report, setReport] = useState<ClientReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/reports/client/${projectId}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report ?? null))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  async function download(format: "pdf" | "docx") {
    if (!projectId) return;
    setDownloading(format);
    try {
      const res = await fetch(`/api/reports/client/${projectId}/export?format=${format}`);
      if (res.ok) await downloadFileFromResponse(res, `client-report.${format}`);
    } finally {
      setDownloading(null);
    }
  }

  if (!projectId) return <p className="text-sm text-neutral-500">Select a client from the dashboard first.</p>;
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!report) return <p className="text-sm text-neutral-500">No report data.</p>;

  const cur = report.currency;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Status" value={report.status} />
        <Stat
          label="Monthly retainer"
          value={report.retainer?.monthly ? money(report.retainer.monthly, cur) : "—"}
        />
        <Stat label="Paid to date" value={money(report.billed.paid, cur)} />
        <Stat
          label="Outstanding"
          value={money(report.billed.outstanding, cur)}
          tone={report.billed.outstanding > 0 ? "text-core-scarlet" : "text-neutral-100"}
        />
      </div>

      <SettingsCard title="Recent billing events">
        {report.recentEvents.length === 0 ? (
          <p className="text-sm text-neutral-500">No billing events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-1 pr-3">Amount</th>
                  <th className="pb-1 pr-3">Status</th>
                  <th className="pb-1 pr-3">Due</th>
                  <th className="pb-1 pr-3">Paid</th>
                  <th className="pb-1">Description</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                {report.recentEvents.map((e, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1 pr-3">{money(Number(e.amount), cur)}</td>
                    <td className="py-1 pr-3">{e.status}</td>
                    <td className="py-1 pr-3">{e.due_date ?? "—"}</td>
                    <td className="py-1 pr-3">{e.paid_date ?? "—"}</td>
                    <td className="py-1">{e.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Ad platforms & pipeline" description="Connect GHL, Meta Ads, or Google Ads in Integrations to show spend, leads, and pipeline health here.">
        <p className="text-sm text-neutral-500">Not connected yet.</p>
      </SettingsCard>

      <SettingsCard title="Client-facing report" description="A shareable PDF or Word doc of the numbers above.">
        <div className="flex gap-2">
          <button onClick={() => download("pdf")} disabled={!!downloading} className={primaryButtonClass}>
            {downloading === "pdf" ? "Generating…" : "Download PDF"}
          </button>
          <button onClick={() => download("docx")} disabled={!!downloading} className={secondaryButtonClass}>
            {downloading === "docx" ? "Generating…" : "Download Word"}
          </button>
        </div>
      </SettingsCard>
    </>
  );
}

function AgencyReportView() {
  const [report, setReport] = useState<AgencyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/agency")
      .then((r) => r.json())
      .then((d) => setReport(d.report ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!report) return <p className="text-sm text-neutral-500">No report data.</p>;

  const cur = report.currency;
  const peak = Math.max(1, ...report.revenueByMonth.map((m) => m.amount));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="MRR" value={money(report.mrr, cur)} />
        <Stat label="Revenue this month" value={money(report.revenueThisMonth, cur)} />
        <Stat label="Overdue" value={money(report.overdueTotal, cur)} tone="text-core-scarlet" />
        <Stat label="Active clients" value={String(report.activeClients)} />
      </div>

      <SettingsCard title="Revenue by month" description="Paid billing events, last 6 months.">
        <div className="flex h-32 items-end gap-2">
          {report.revenueByMonth.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-core-purple/50"
                style={{ height: `${Math.max(2, (m.amount / peak) * 100)}%` }}
                title={money(m.amount, cur)}
              />
              <span className="text-[10px] text-neutral-500">{m.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Clients by status">
        <div className="space-y-1.5">
          {Object.entries(report.statusCounts).map(([s, n]) => (
            <div key={s} className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">{s[0].toUpperCase() + s.slice(1)}</span>
              <span className="text-neutral-100">{n}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
