import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAgencyBillingSummary,
  monthlyValue,
  type AgencyBillingSummary,
  type BillingEventStatus,
} from "@/lib/billing";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

export type ClientReportEvent = {
  amount: number;
  status: BillingEventStatus;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
};

export type ClientReport = {
  projectName: string;
  status: string;
  industry: string | null;
  clientSince: string;
  currency: string;
  retainer: { amount: number | null; frequency: string | null; monthly: number } | null;
  billed: { invoiced: number; paid: number; outstanding: number };
  recentEvents: ClientReportEvent[];
};

export type AgencyReport = AgencyBillingSummary & {
  revenueByMonth: { month: string; amount: number }[];
};

export async function getClientReport(
  supabase: SupabaseClient,
  projectId: string
): Promise<ClientReport | null> {
  const { data: proj } = await supabase
    .from("projects")
    .select("name, status, industry, created_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) return null;

  const { data: billing } = await supabase
    .from("client_billing")
    .select("retainer_amount, billing_frequency, currency")
    .eq("project_id", projectId)
    .maybeSingle();

  const { data: eventsData } = await supabase
    .from("billing_events")
    .select("amount, status, due_date, paid_date, description")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const events = (eventsData ?? []) as ClientReportEvent[];
  const paid = sum(events.filter((e) => e.status === "paid").map((e) => Number(e.amount)));
  const invoiced = sum(
    events.filter((e) => e.status !== "void").map((e) => Number(e.amount))
  );
  const outstanding = sum(
    events
      .filter((e) => e.status === "pending" || e.status === "invoiced" || e.status === "overdue")
      .map((e) => Number(e.amount))
  );

  const p = proj as {
    name: string;
    status: string;
    industry: string | null;
    created_at: string;
  };

  return {
    projectName: p.name,
    status: p.status,
    industry: p.industry,
    clientSince: p.created_at.slice(0, 10),
    currency: billing?.currency ?? "USD",
    retainer: billing
      ? {
          amount: billing.retainer_amount,
          frequency: billing.billing_frequency,
          monthly: monthlyValue(billing),
        }
      : null,
    billed: { invoiced, paid, outstanding },
    recentEvents: events.slice(0, 12),
  };
}

export async function getAgencyReport(supabase: SupabaseClient): Promise<AgencyReport> {
  const summary = await getAgencyBillingSummary(supabase);

  const { data: paidEvents } = await supabase
    .from("billing_events")
    .select("amount, paid_date")
    .eq("status", "paid");

  // Last 6 calendar months, oldest first.
  const now = new Date();
  const buckets: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ month: d.toISOString().slice(0, 7), amount: 0 });
  }
  for (const ev of (paidEvents ?? []) as { amount: number; paid_date: string | null }[]) {
    if (!ev.paid_date) continue;
    const key = ev.paid_date.slice(0, 7);
    const bucket = buckets.find((b) => b.month === key);
    if (bucket) bucket.amount += Number(ev.amount);
  }

  return { ...summary, revenueByMonth: buckets };
}

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

// Markdown source for the PDF/Word export — fed to the existing
// documentGenerators, same as an agent-authored deliverable.
export function clientReportMarkdown(r: ClientReport): string {
  const lines: string[] = [
    `# ${r.projectName} — Client Report`,
    "",
    `**Status:** ${r.status}  `,
    `**Industry:** ${r.industry ?? "—"}  `,
    `**Client since:** ${r.clientSince}`,
    "",
    "## Commercials",
    "",
  ];
  if (r.retainer && r.retainer.amount != null) {
    lines.push(
      `- Retainer: ${fmt(r.retainer.amount, r.currency)} ${r.retainer.frequency ?? ""}`.trim(),
      `- Normalised monthly value: ${fmt(r.retainer.monthly, r.currency)}`
    );
  } else {
    lines.push("- No retainer on file");
  }
  lines.push(
    "",
    "## Billing to date",
    "",
    `- Invoiced: ${fmt(r.billed.invoiced, r.currency)}`,
    `- Paid: ${fmt(r.billed.paid, r.currency)}`,
    `- Outstanding: ${fmt(r.billed.outstanding, r.currency)}`,
    "",
    "## Recent billing events",
    "",
    "| Amount | Status | Due | Paid | Description |",
    "| --- | --- | --- | --- | --- |"
  );
  for (const e of r.recentEvents) {
    lines.push(
      `| ${fmt(Number(e.amount), r.currency)} | ${e.status} | ${e.due_date ?? "—"} | ${e.paid_date ?? "—"} | ${e.description ?? "—"} |`
    );
  }
  if (r.recentEvents.length === 0) lines.push("| — | — | — | — | No billing events yet |");
  return lines.join("\n");
}
