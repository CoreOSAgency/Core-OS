import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteBillingEvent,
  updateBillingEvent,
  type BillingEvent,
  type BillingEventStatus,
} from "@/lib/billing";

const STATUSES: BillingEventStatus[] = [
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "void",
];

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string; eventId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fields: Partial<
    Omit<BillingEvent, "id" | "project_id" | "created_at" | "source">
  > = {};

  if (typeof body?.amount === "number" && isFinite(body.amount) && body.amount > 0) {
    fields.amount = body.amount;
  }
  if (typeof body?.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    fields.status = body.status;
    // Marking paid without an explicit date stamps today.
    if (body.status === "paid" && body?.paid_date === undefined) {
      fields.paid_date = new Date().toISOString().slice(0, 10);
    }
  }
  if (body?.due_date === null || typeof body?.due_date === "string") {
    fields.due_date = body.due_date || null;
  }
  if (body?.paid_date === null || typeof body?.paid_date === "string") {
    fields.paid_date = body.paid_date || null;
  }
  if (typeof body?.description === "string") {
    fields.description = body.description.trim() || null;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // RLS scopes the update to events under projects the caller owns.
  const event = await updateBillingEvent(supabase, params.eventId, fields);
  return NextResponse.json({ event });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string; eventId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteBillingEvent(supabase, params.eventId);
  return NextResponse.json({ ok: true });
}
