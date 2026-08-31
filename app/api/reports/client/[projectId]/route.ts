import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientReport } from "@/lib/reports";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes every underlying read to a project the caller owns.
  const report = await getClientReport(supabase, params.projectId);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}
