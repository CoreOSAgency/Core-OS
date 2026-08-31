import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runWorkflow, type Workflow } from "@/lib/workflowEngine";

export const maxDuration = 300;

// Inbound webhook: no session, so it needs the service-role key to read the
// workflow past RLS. Callers prove themselves with the x-workflow-secret
// header (minted when the workflow is switched to trigger_type 'webhook').
// ponytail: gated on SUPABASE_SERVICE_ROLE_KEY. The alternative that avoids
// the service key is a `security definer` SQL function taking (id, secret) —
// add that if you'd rather not put the service key in the env.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Webhook triggers need SUPABASE_SERVICE_ROLE_KEY configured on the server" },
      { status: 501 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: workflow } = await admin
    .from("workflows")
    .select(
      "id, user_id, project_id, name, definition, is_active, trigger_type, trigger_config, created_at, updated_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!workflow || workflow.trigger_type !== "webhook" || !workflow.is_active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const secret = (workflow.trigger_config as { secret?: string } | null)?.secret;
  if (!secret || request.headers.get("x-workflow-secret") !== secret) {
    return NextResponse.json({ error: "Bad or missing x-workflow-secret" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const input =
    typeof body?.input === "string"
      ? body.input
      : body == null
        ? ""
        : JSON.stringify(body);

  const run = await runWorkflow(admin, workflow as Workflow, input);
  return NextResponse.json({ run });
}
