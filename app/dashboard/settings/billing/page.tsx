"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveProject } from "@/lib/useActiveProject";
import type { ClientStatus } from "@/lib/projects";
import type {
  AgencyBillingSummary,
  BillingEvent,
  BillingEventStatus,
  BillingFrequency,
  ClientBilling,
} from "@/lib/billing";
import {
  SettingsPage,
  SettingsCard,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "../SettingsUI";

const FREQ_LABELS: Record<BillingFrequency, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  one_time: "One-time",
  custom: "Custom",
};

const CLIENT_STATUSES: ClientStatus[] = [
  "lead",
  "onboarding",
  "active",
  "paused",
  "churned",
];

const EVENT_STATUSES: BillingEventStatus[] = [
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "void",
];

function money(amount: number | null | undefined, currency = "USD"): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const STATUS_TONE: Record<BillingEventStatus, string> = {
  paid: "text-emerald-400",
  overdue: "text-red-400",
  pending: "text-neutral-400",
  invoiced: "text-sky-400",
  void: "text-neutral-600",
};

export default function BillingPage() {
  const [tab, setTab] = useState<"client" | "agency">("client");

  return (
    <SettingsPage
      title="Billing & Retainers"
      description="Track what each client pays and where the agency stands overall."
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

      {tab === "client" ? <ClientBillingView /> : <AgencyView />}
    </SettingsPage>
  );
}

function ClientBillingView() {
  const { project, refresh: refreshProject } = useActiveProject();
  const projectId = project?.id ?? null;

  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRetainer, setSavingRetainer] = useState(false);

  // Retainer form state
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<BillingFrequency | "">("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [minTerm, setMinTerm] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${projectId}/billing`).then((r) => r.json()),
      fetch(`/api/clients/${projectId}/billing/events`).then((r) => r.json()),
    ])
      .then(([b, e]) => {
        const bill: ClientBilling | null = b.billing ?? null;
        setBilling(bill);
        setAmount(bill?.retainer_amount != null ? String(bill.retainer_amount) : "");
        setFrequency(bill?.billing_frequency ?? "");
        setCurrency(bill?.currency ?? "USD");
        setStartDate(bill?.billing_start_date ?? "");
        setMinTerm(bill?.minimum_term_months != null ? String(bill.minimum_term_months) : "");
        setNotes(bill?.notes ?? "");
        setEvents(e.events ?? []);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  async function saveRetainer() {
    if (!projectId) return;
    setSavingRetainer(true);
    try {
      const res = await fetch(`/api/clients/${projectId}/billing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retainer_amount: amount.trim() === "" ? null : Number(amount),
          billing_frequency: frequency || null,
          currency: currency.trim() || "USD",
          billing_start_date: startDate || null,
          minimum_term_months: minTerm.trim() === "" ? null : Number(minTerm),
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) setBilling(data.billing);
    } finally {
      setSavingRetainer(false);
    }
  }

  async function setStatus(status: ClientStatus) {
    if (!projectId) return;
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refreshProject();
  }

  if (!projectId) {
    return <p className="text-sm text-neutral-500">Select a client from the dashboard first.</p>;
  }
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  const monthly =
    billing?.retainer_amount && billing.billing_frequency === "monthly"
      ? billing.retainer_amount
      : billing?.retainer_amount && billing.billing_frequency === "weekly"
        ? (billing.retainer_amount * 52) / 12
        : 0;

  return (
    <>
      <SettingsCard title="Client status" description="Only 'active' clients count toward agency MRR.">
        <select
          value={project?.status ?? "active"}
          onChange={(e) => setStatus(e.target.value as ClientStatus)}
          className={inputClass}
        >
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </SettingsCard>

      <SettingsCard
        title="Retainer"
        description={
          monthly > 0 ? `Normalised to ${money(monthly, currency)} / month` : "The recurring agreement with this client."
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as BillingFrequency | "")}
              className={inputClass}
            >
              <option value="">—</option>
              {(Object.keys(FREQ_LABELS) as BillingFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Minimum term (months)</label>
            <input
              type="number"
              min="0"
              value={minTerm}
              onChange={(e) => setMinTerm(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
        <button onClick={saveRetainer} disabled={savingRetainer} className={primaryButtonClass}>
          {savingRetainer ? "Saving…" : "Save retainer"}
        </button>
      </SettingsCard>

      <EventsCard
        projectId={projectId}
        currency={currency}
        events={events}
        onChange={load}
      />
    </>
  );
}

function EventsCard({
  projectId,
  currency,
  events,
  onChange,
}: {
  projectId: string;
  currency: string;
  events: BillingEvent[];
  onChange: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<BillingEventStatus>("pending");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${projectId}/billing/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: n,
          description,
          due_date: dueDate || undefined,
          status,
          currency,
        }),
      });
      if (res.ok) {
        setAmount("");
        setDescription("");
        setDueDate("");
        setStatus("pending");
        onChange();
      }
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${projectId}/billing/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) onChange();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/clients/${projectId}/billing/events/${id}`, {
        method: "DELETE",
      });
      if (res.ok) onChange();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SettingsCard title="Billing events" description="Invoices and payments for this client.">
      {events.length === 0 && <p className="text-sm text-neutral-500">No billing events yet.</p>}

      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-core-main px-3 py-2 text-sm"
          >
            <span className="font-medium text-neutral-100">{money(ev.amount, ev.currency)}</span>
            <span className="min-w-0 flex-1 truncate text-neutral-400">
              {ev.description || "—"}
            </span>
            {ev.due_date && (
              <span className="text-xs text-neutral-500">due {ev.due_date}</span>
            )}
            <span className={`text-xs font-medium ${STATUS_TONE[ev.status]}`}>{ev.status}</span>
            {ev.status !== "paid" && ev.status !== "void" && (
              <button
                onClick={() => patch(ev.id, { status: "paid" })}
                disabled={busyId === ev.id}
                className="rounded border border-white/10 px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/5 disabled:opacity-50"
              >
                Mark paid
              </button>
            )}
            <button
              onClick={() => remove(ev.id)}
              disabled={busyId === ev.id}
              className="rounded border border-white/10 px-2 py-0.5 text-xs text-neutral-500 hover:bg-white/5 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-white/10 pt-3 sm:grid-cols-[1fr_2fr_1fr_1fr_auto]">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BillingEventStatus)}
          className={inputClass}
        >
          {EVENT_STATUSES.filter((s) => s !== "void").map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={add} disabled={adding || !amount} className={primaryButtonClass}>
          {adding ? "…" : "Add"}
        </button>
      </div>
    </SettingsCard>
  );
}

function AgencyView() {
  const [summary, setSummary] = useState<AgencyBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/summary")
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!summary) return <p className="text-sm text-neutral-500">Couldn&apos;t load the summary.</p>;

  const cur = summary.currency;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="MRR" value={money(summary.mrr, cur)} />
        <Stat label="Revenue this month" value={money(summary.revenueThisMonth, cur)} />
        <Stat label="Overdue" value={money(summary.overdueTotal, cur)} tone="text-red-400" />
        <Stat label="Active clients" value={String(summary.activeClients)} />
      </div>

      <SettingsCard title="Clients by status">
        <div className="space-y-1.5">
          {CLIENT_STATUSES.map((s) => (
            <div key={s} className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">{s[0].toUpperCase() + s.slice(1)}</span>
              <span className="text-neutral-100">{summary.statusCounts[s]}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}

function Stat({
  label,
  value,
  tone = "text-neutral-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-core-card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
