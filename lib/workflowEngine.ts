import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/systemPrompts";
import { getModelConfig } from "@/lib/modelRouter";

export type TriggerType = "manual" | "schedule" | "webhook";

export type WorkflowNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: { agent: { id: string; name: string; emoji: string } };
};
export type WorkflowEdge = { id: string; source: string; target: string };
export type WorkflowDefinition = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export type Workflow = {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  definition: WorkflowDefinition;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type StepResult = {
  nodeId: string;
  agentId: string;
  agentName: string;
  input: string;
  output: string;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  status: "running" | "completed" | "failed";
  step_results: StepResult[];
  started_at: string;
  finished_at: string | null;
};

const WORKFLOW_COLS =
  "id, user_id, project_id, name, definition, is_active, trigger_type, trigger_config, created_at, updated_at";
const RUN_COLS = "id, workflow_id, status, step_results, started_at, finished_at";

export async function listWorkflows(supabase: SupabaseClient): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select(WORKFLOW_COLS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Workflow[];
}

export async function getWorkflow(
  supabase: SupabaseClient,
  id: string
): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from("workflows")
    .select(WORKFLOW_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Workflow) ?? null;
}

export async function createWorkflow(
  supabase: SupabaseClient,
  userId: string,
  fields: { name: string; definition: WorkflowDefinition; project_id?: string | null }
): Promise<Workflow> {
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      user_id: userId,
      name: fields.name,
      definition: fields.definition,
      project_id: fields.project_id ?? null,
    })
    .select(WORKFLOW_COLS)
    .single();
  if (error) throw error;
  return data as unknown as Workflow;
}

export async function updateWorkflow(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<
    Pick<Workflow, "name" | "definition" | "is_active" | "trigger_type" | "trigger_config">
  >
): Promise<Workflow> {
  const { data, error } = await supabase
    .from("workflows")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(WORKFLOW_COLS)
    .single();
  if (error) throw error;
  return data as unknown as Workflow;
}

export async function deleteWorkflow(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) throw error;
}

// Linear chains only: one start node (no incoming edge), every node has <= 1
// incoming and <= 1 outgoing edge, and all nodes form one connected path.
// Returns node ids in execution order.
// ponytail: branching / parallel paths are a genuinely separate problem — not v1.
export function linearOrder(def: WorkflowDefinition): string[] {
  const nodes = def.nodes ?? [];
  const edges = def.edges ?? [];
  if (nodes.length === 0) throw new Error("Workflow has no agents");

  const outgoing = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!outgoing.has(e.source) || !indeg.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) {
    if ((outgoing.get(n.id)?.length ?? 0) > 1 || (indeg.get(n.id) ?? 0) > 1) {
      throw new Error("Only linear agent chains are supported in v1");
    }
  }
  const starts = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  if (nodes.length > 1 && starts.length !== 1) {
    throw new Error("Connect the agents into a single chain before running");
  }

  const order: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = starts[0]?.id ?? nodes[0].id;
  while (current && !seen.has(current)) {
    seen.add(current);
    order.push(current);
    current = outgoing.get(current)?.[0];
  }
  if (order.length !== nodes.length) {
    throw new Error("Connect the agents into a single chain before running");
  }
  return order;
}

async function callAgent(agentId: string, input: string): Promise<string> {
  const systemPrompt = buildSystemPrompt(agentId, "standard");
  if (!systemPrompt) throw new Error(`Unknown agent: ${agentId}`);
  const model = getModelConfig("standard").model;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: "medium" },
          maxOutputTokens: 4096,
        },
      }),
    }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Gemini HTTP ${res.status}`);
  }
  const parts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Agent returned no text");
  return text;
}

// Runs a workflow's linear agent chain, feeding each agent's output to the
// next. Records one workflow_runs row.
// ponytail: writes step_results once at the end, not per step — a run is a
// handful of sequential calls and nothing polls mid-run in v1. Switch to
// per-step writes when runs get long enough to want live progress.
export async function runWorkflow(
  supabase: SupabaseClient,
  workflow: Workflow,
  triggerInput: string
): Promise<WorkflowRun> {
  const { data: runRow, error: insErr } = await supabase
    .from("workflow_runs")
    .insert({ workflow_id: workflow.id, status: "running", step_results: [] })
    .select(RUN_COLS)
    .single();
  if (insErr) throw insErr;

  const nodesById = new Map(
    (workflow.definition.nodes ?? []).map((n) => [n.id, n])
  );
  const steps: StepResult[] = [];
  let status: WorkflowRun["status"] = "completed";
  let input = triggerInput;

  try {
    for (const nodeId of linearOrder(workflow.definition)) {
      const agent = nodesById.get(nodeId)?.data?.agent;
      if (!agent) {
        steps.push({ nodeId, agentId: "", agentName: "?", input, output: "", error: "Node has no agent" });
        status = "failed";
        break;
      }
      try {
        const output = await callAgent(agent.id, input);
        steps.push({ nodeId, agentId: agent.id, agentName: agent.name, input, output });
        input = output;
      } catch (err) {
        steps.push({
          nodeId,
          agentId: agent.id,
          agentName: agent.name,
          input,
          output: "",
          error: err instanceof Error ? err.message : "step failed",
        });
        status = "failed";
        break;
      }
    }
  } catch (err) {
    status = "failed";
    steps.push({
      nodeId: "",
      agentId: "",
      agentName: "",
      input,
      output: "",
      error: err instanceof Error ? err.message : "workflow could not run",
    });
  }

  const { data: finalRow, error: updErr } = await supabase
    .from("workflow_runs")
    .update({ status, step_results: steps, finished_at: new Date().toISOString() })
    .eq("id", runRow.id)
    .select(RUN_COLS)
    .single();
  if (updErr) throw updErr;
  return finalRow as unknown as WorkflowRun;
}
