import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getClientBilling,
  upsertClientBilling,
  type BillingFrequency,
  type ClientBilling,
} from "@/lib/billing";

const FREQS: BillingFrequency[] = ["monthly", "weekly", "one_time", "custom"];

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes this to a project the caller owns — otherwise it's just null.
  const billing = await getClientBilling(supabase, params.projectId);
  return NextResponse.json({ billing });
}

export async function PUT(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fields: Partial<Omit<ClientBilling, "project_id">> = {};

  if (body?.retainer_amount === null || typeof body?.retainer_amount === "number") {
    if (typeof body.retainer_amount === "number" && body.retainer_amount < 0) {
      return NextResponse.json({ error: "retainer_amount must be >= 0" }, { status: 400 });
    }
    fields.retainer_amount = body.retainer_amount;
  }
  if (body?.billing_frequency === null) {
    fields.billing_frequency = null;
  } else if (typeof body?.billing_frequency === "string") {
    if (!FREQS.includes(body.billing_frequency)) {
      return NextResponse.json({ error: "Invalid billing_frequency" }, { status: 400 });
    }
    fields.billing_frequency = body.billing_frequency;
  }
  if (typeof body?.currency === "string" && body.currency.trim()) {
    fields.currency = body.currency.trim().toUpperCase().slice(0, 3);
  }
  if (body?.billing_start_date === null || typeof body?.billing_start_date === "string") {
    fields.billing_start_date = body.billing_start_date || null;
  }
  if (body?.minimum_term_months === null || typeof body?.minimum_term_months === "number") {
    fields.minimum_term_months = body.minimum_term_months;
  }
  if (typeof body?.notes === "string") {
    fields.notes = body.notes.trim() || null;
  }

  const billing = await upsertClientBilling(supabase, params.projectId, fields);
  return NextResponse.json({ billing });
}
