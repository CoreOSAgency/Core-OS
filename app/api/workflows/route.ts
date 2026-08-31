import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createWorkflow,
  listWorkflows,
  type WorkflowDefinition,
} from "@/lib/workflowEngine";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await listWorkflows(supabase);
  return NextResponse.json({ workflows });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name =
    typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;
  const definition = body?.definition as WorkflowDefinition | undefined;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (
    !definition ||
    !Array.isArray(definition.nodes) ||
    !Array.isArray(definition.edges)
  ) {
    return NextResponse.json(
      { error: "definition must have nodes and edges arrays" },
      { status: 400 }
    );
  }

  const project_id =
    typeof body?.project_id === "string" ? body.project_id : null;
  const workflow = await createWorkflow(supabase, user.id, {
    name,
    definition,
    project_id,
  });
  return NextResponse.json({ workflow });
}
