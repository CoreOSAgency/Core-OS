import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createBillingEvent,
  listBillingEvents,
  type BillingEventStatus,
} from "@/lib/billing";

const STATUSES: BillingEventStatus[] = [
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "void",
];

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await listBillingEvents(supabase, params.projectId);
  return NextResponse.json({ events });
}

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const amount = body?.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  const fields: Parameters<typeof createBillingEvent>[2] = { amount };
  if (typeof body?.currency === "string" && body.currency.trim()) {
    fields.currency = body.currency.trim().toUpperCase().slice(0, 3);
  }
  if (typeof body?.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    fields.status = body.status;
  }
  if (typeof body?.due_date === "string" && body.due_date) fields.due_date = body.due_date;
  if (typeof body?.paid_date === "string" && body.paid_date) fields.paid_date = body.paid_date;
  if (typeof body?.description === "string") fields.description = body.description.trim() || null;

  const event = await createBillingEvent(supabase, params.projectId, fields);
  return NextResponse.json({ event });
}
