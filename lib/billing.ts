import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientStatus } from "@/lib/projects";

export type BillingFrequency = "monthly" | "weekly" | "one_time" | "custom";
export type BillingEventStatus =
  | "pending"
  | "invoiced"
  | "paid"
  | "overdue"
  | "void";

export type ClientBilling = {
  project_id: string;
  retainer_amount: number | null;
  billing_frequency: BillingFrequency | null;
  currency: string;
  billing_start_date: string | null;
  minimum_term_months: number | null;
  notes: string | null;
};

export type BillingEvent = {
  id: string;
  project_id: string;
  amount: number;
  currency: string;
  status: BillingEventStatus;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
  source: "manual" | "stripe";
  created_at: string;
};

export type AgencyBillingSummary = {
  mrr: number;
  // ponytail: naive single-currency sum — clients on mixed currencies aren't
  // converted. Group by currency here if that ever happens.
  currency: string;
  revenueThisMonth: number;
  overdueTotal: number;
  activeClients: number;
  statusCounts: Record<ClientStatus, number>;
};

const BILLING_COLUMNS =
  "project_id, retainer_amount, billing_frequency, currency, billing_start_date, minimum_term_months, notes";
const EVENT_COLUMNS =
  "id, project_id, amount, currency, status, due_date, paid_date, description, source, created_at";

// Normalise a retainer to a monthly figure. one_time / custom don't
// contribute to recurring revenue.
export function monthlyValue(b: {
  retainer_amount: number | null;
  billing_frequency: BillingFrequency | null;
}): number {
  if (!b.retainer_amount || !b.billing_frequency) return 0;
  switch (b.billing_frequency) {
    case "monthly":
      return b.retainer_amount;
    case "weekly":
      return (b.retainer_amount * 52) / 12;
    default:
      return 0;
  }
}

export async function getClientBilling(
  supabase: SupabaseClient,
  projectId: string
): Promise<ClientBilling | null> {
  const { data, error } = await supabase
    .from("client_billing")
    .select(BILLING_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ClientBilling) ?? null;
}

export async function upsertClientBilling(
  supabase: SupabaseClient,
  projectId: string,
  fields: Partial<Omit<ClientBilling, "project_id">>
): Promise<ClientBilling> {
  const { data, error } = await supabase
    .from("client_billing")
    .upsert(
      { project_id: projectId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "project_id" }
    )
    .select(BILLING_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ClientBilling;
}

export async function listBillingEvents(
  supabase: SupabaseClient,
  projectId: string
): Promise<BillingEvent[]> {
  const { data, error } = await supabase
    .from("billing_events")
    .select(EVENT_COLUMNS)
    .eq("project_id", projectId)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as BillingEvent[];
}

export async function createBillingEvent(
  supabase: SupabaseClient,
  projectId: string,
  fields: Partial<Omit<BillingEvent, "id" | "project_id" | "created_at" | "source">> & {
    amount: number;
  }
): Promise<BillingEvent> {
  const { data, error } = await supabase
    .from("billing_events")
    .insert({ project_id: projectId, source: "manual", ...fields })
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as BillingEvent;
}

export async function updateBillingEvent(
  supabase: SupabaseClient,
  eventId: string,
  fields: Partial<Omit<BillingEvent, "id" | "project_id" | "created_at" | "source">>
): Promise<BillingEvent> {
  // RLS scopes this to events under projects the caller owns.
  const { data, error } = await supabase
    .from("billing_events")
    .update(fields)
    .eq("id", eventId)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as BillingEvent;
}

export async function deleteBillingEvent(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase.from("billing_events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function getAgencyBillingSummary(
  supabase: SupabaseClient
): Promise<AgencyBillingSummary> {
  // All three reads are RLS-scoped to the caller's own projects.
  const [{ data: projects, error: pErr }, { data: billing, error: bErr }, { data: events, error: eErr }] =
    await Promise.all([
      supabase.from("projects").select("status"),
      supabase
        .from("client_billing")
        .select("retainer_amount, billing_frequency, currency, projects!inner(status)"),
      supabase.from("billing_events").select("amount, status, due_date, paid_date"),
    ]);
  if (pErr) throw pErr;
  if (bErr) throw bErr;
  if (eErr) throw eErr;

  const statusCounts: Record<ClientStatus, number> = {
    lead: 0,
    onboarding: 0,
    active: 0,
    paused: 0,
    churned: 0,
  };
  for (const p of (projects ?? []) as { status: ClientStatus }[]) {
    if (p.status in statusCounts) statusCounts[p.status]++;
  }

  let mrr = 0;
  let currency = "USD";
  for (const row of (billing ?? []) as unknown as Array<{
    retainer_amount: number | null;
    billing_frequency: BillingFrequency | null;
    currency: string;
    projects: { status: ClientStatus } | { status: ClientStatus }[];
  }>) {
    const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    if (proj?.status !== "active") continue;
    mrr += monthlyValue(row);
    if (row.currency) currency = row.currency;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  let revenueThisMonth = 0;
  let overdueTotal = 0;
  for (const ev of (events ?? []) as Array<{
    amount: number;
    status: BillingEventStatus;
    due_date: string | null;
    paid_date: string | null;
  }>) {
    if (ev.status === "paid" && ev.paid_date && ev.paid_date >= monthStart) {
      revenueThisMonth += Number(ev.amount);
    }
    const unpaidPastDue =
      (ev.status === "pending" || ev.status === "invoiced") &&
      ev.due_date != null &&
      ev.due_date < today;
    if (ev.status === "overdue" || unpaidPastDue) {
      overdueTotal += Number(ev.amount);
    }
  }

  return {
    mrr,
    currency,
    revenueThisMonth,
    overdueTotal,
    activeClients: statusCounts.active,
    statusCounts,
  };
}
