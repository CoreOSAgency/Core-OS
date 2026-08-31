import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteWorkflow,
  getWorkflow,
  updateWorkflow,
  type TriggerType,
  type Workflow,
} from "@/lib/workflowEngine";

const TRIGGERS: TriggerType[] = ["manual", "schedule", "webhook"];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflow = await getWorkflow(supabase, params.id);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ workflow });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fields: Partial<
    Pick<Workflow, "name" | "definition" | "is_active" | "trigger_type" | "trigger_config">
  > = {};

  if (typeof body?.name === "string" && body.name.trim()) fields.name = body.name.trim();
  if (body?.definition && Array.isArray(body.definition.nodes)) {
    fields.definition = body.definition;
  }
  if (typeof body?.is_active === "boolean") fields.is_active = body.is_active;

  if (typeof body?.trigger_type === "string") {
    if (!TRIGGERS.includes(body.trigger_type)) {
      return NextResponse.json({ error: "Invalid trigger_type" }, { status: 400 });
    }
    fields.trigger_type = body.trigger_type;
    if (body.trigger_type === "webhook") {
      // Mint a secret the first time it becomes a webhook; keep it after that.
      const existing = await getWorkflow(supabase, params.id);
      const current = (existing?.trigger_config ?? {}) as Record<string, unknown>;
      fields.trigger_config = {
        ...current,
        secret: (current.secret as string) ?? randomUUID(),
      };
    }
  }
  if (body?.trigger_config && typeof body.trigger_config === "object") {
    fields.trigger_config = { ...(fields.trigger_config ?? {}), ...body.trigger_config };
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const workflow = await updateWorkflow(supabase, params.id, fields);
  return NextResponse.json({ workflow });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteWorkflow(supabase, params.id);
  return NextResponse.json({ ok: true });
}
