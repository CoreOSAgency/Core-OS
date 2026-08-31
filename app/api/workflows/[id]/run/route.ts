import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkflow, runWorkflow } from "@/lib/workflowEngine";

// A run is several sequential Gemini calls — give it room past the old 60s.
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await getWorkflow(supabase, params.id);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const input = typeof body?.input === "string" ? body.input : "";

  const run = await runWorkflow(supabase, workflow, input);
  return NextResponse.json({ run });
}
