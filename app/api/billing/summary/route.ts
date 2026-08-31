import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgencyBillingSummary } from "@/lib/billing";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await getAgencyBillingSummary(supabase);
  return NextResponse.json({ summary });
}
