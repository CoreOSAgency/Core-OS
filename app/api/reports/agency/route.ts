import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgencyReport } from "@/lib/reports";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await getAgencyReport(supabase);
  return NextResponse.json({ report });
}
