"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { agentSections, type Agent } from "@/lib/agents";
import type {
  StepResult,
  TriggerType,
  WorkflowDefinition,
} from "@/lib/workflowEngine";

type AgentNodeData = { agent: Agent };

type WorkflowSummary = {
  id: string;
  name: string;
  definition: WorkflowDefinition;
  trigger_type: TriggerType;
  trigger_config: { secret?: string } | null;
};

type RunResult = {
  id: string;
  status: "running" | "completed" | "failed";
  step_results: StepResult[];
};

function AgentNode({ data }: NodeProps) {
  const { agent } = data as unknown as AgentNodeData;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-core-card px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-core-purple" />
      <span className="text-lg">{agent.emoji}</span>
      <span className="text-sm font-medium text-neutral-100">{agent.name}</span>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-core-purple" />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled workflow");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextPos = useRef({ x: 80, y: 80 });

  const current = workflows.find((w) => w.id === currentId) ?? null;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workflows");
    const data = await res.json();
    setWorkflows(data.workflows ?? []);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onNodesChange = useCallback(
    (c: NodeChange[]) => setNodes((n) => applyNodeChanges(c, n)),
    []
  );
  const onEdgesChange = useCallback(
    (c: EdgeChange[]) => setEdges((e) => applyEdgeChanges(c, e)),
    []
  );
  const onConnect = useCallback(
    (c: Connection) => setEdges((e) => addEdge(c, e)),
    []
  );

  function newWorkflow() {
    setCurrentId(null);
    setName("Untitled workflow");
    setNodes([]);
    setEdges([]);
    setRun(null);
    setError(null);
  }

  function loadWorkflow(w: WorkflowSummary) {
    setCurrentId(w.id);
    setName(w.name);
    setNodes((w.definition.nodes ?? []) as unknown as Node[]);
    setEdges((w.definition.edges ?? []) as unknown as Edge[]);
    setRun(null);
    setError(null);
  }

  function addAgent(agent: Agent) {
    const pos = { ...nextPos.current };
    nextPos.current = { x: pos.x + 40, y: pos.y + 90 };
    setNodes((nds) => [
      ...nds,
      { id: `${agent.id}-${Date.now()}`, type: "agent", position: pos, data: { agent } },
    ]);
  }

  function clearCanvas() {
    setNodes([]);
    setEdges([]);
  }

  function serialize(): WorkflowDefinition {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })) as WorkflowDefinition["nodes"],
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const definition = serialize();
      const res = currentId
        ? await fetch(`/api/workflows/${currentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, definition }),
          })
        : await fetch("/api/workflows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, definition }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setCurrentId(data.workflow.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!currentId) {
      setError("Save the workflow before running it.");
      return;
    }
    setRunning(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch(`/api/workflows/${currentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: runInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Run failed");
      setRun(data.run);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  async function del() {
    if (!currentId) return;
    await fetch(`/api/workflows/${currentId}`, { method: "DELETE" });
    newWorkflow();
    await refresh();
  }

  async function toggleWebhook() {
    if (!currentId) return;
    const next: TriggerType =
      current?.trigger_type === "webhook" ? "manual" : "webhook";
    const res = await fetch(`/api/workflows/${currentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_type: next, is_active: next === "webhook" }),
    });
    if (res.ok) await refresh();
  }

  const webhookSecret = current?.trigger_config?.secret;
  const webhookUrl =
    current?.trigger_type === "webhook" && webhookSecret && typeof window !== "undefined"
      ? `${window.location.origin}/api/workflows/${current.id}/trigger`
      : null;

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-white/5 bg-core-nav p-3">
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-neutral-100">Workflows</h2>
            <button
              onClick={newWorkflow}
              className="text-xs text-core-purple hover:underline"
            >
              + New
            </button>
          </div>
          <ul className="space-y-0.5">
            {workflows.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => loadWorkflow(w)}
                  className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5 ${
                    w.id === currentId ? "bg-white/5 text-core-purple" : "text-neutral-300"
                  }`}
                >
                  {w.name}
                </button>
              </li>
            ))}
            {workflows.length === 0 && (
              <li className="px-2 py-1 text-xs text-neutral-600">
                No saved workflows yet.
              </li>
            )}
          </ul>
        </div>

        <p className="mb-2 px-1 text-xs text-neutral-500">
          Click an agent to add it, then drag between nodes to connect a chain.
        </p>
        {agentSections.map((section) => (
          <div key={section.id} className="mb-4">
            <p className="px-1 pb-1 text-[10px] font-semibold tracking-widest text-core-gold">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.agents.map((agent) => (
                <li key={agent.id}>
                  <button
                    onClick={() => addAgent(agent)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-white/5"
                  >
                    <span>{agent.emoji}</span>
                    <span>{agent.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          onClick={clearCanvas}
          className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5"
        >
          Clear canvas
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded-lg border border-white/10 bg-core-main px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-core-purple"
          />
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-core-purple px-3 py-1.5 text-sm font-medium text-[#04170d] hover:bg-core-purple/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={runNow}
            disabled={running || !currentId}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
          >
            {running ? "Running…" : "Run"}
          </button>
          {currentId && (
            <>
              <button
                onClick={toggleWebhook}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/5"
              >
                {current?.trigger_type === "webhook" ? "Webhook: on" : "Webhook: off"}
              </button>
              <button
                onClick={del}
                className="rounded-lg border border-core-scarlet/40 px-3 py-1.5 text-sm text-core-scarlet hover:bg-core-scarlet/10"
              >
                Delete
              </button>
            </>
          )}
          {error && <span className="text-xs text-core-scarlet">{error}</span>}
        </div>

        {webhookUrl && (
          <div className="border-b border-white/5 bg-core-card/40 px-4 py-2 text-xs text-neutral-400">
            POST <code className="text-neutral-200">{webhookUrl}</code> with header{" "}
            <code className="text-neutral-200">x-workflow-secret: {webhookSecret}</code>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <p className="text-sm text-neutral-600">
                  Click an agent on the left to add it to the canvas.
                </p>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              colorMode="dark"
              deleteKeyCode={["Backspace", "Delete"]}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable className="!bg-core-card" />
            </ReactFlow>
          </div>

          <aside className="flex w-[320px] shrink-0 flex-col border-l border-white/5 bg-core-nav">
            <div className="border-b border-white/5 p-3">
              <label className="mb-1 block text-xs text-neutral-500">
                Run input (goes to the first agent)
              </label>
              <textarea
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-core-main px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-core-purple"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!run && !running && (
                <p className="text-xs text-neutral-600">
                  Run the workflow to see each agent&apos;s output here.
                </p>
              )}
              {running && <p className="text-xs text-neutral-400">Running the chain…</p>}
              {run && (
                <div className="space-y-3">
                  <p
                    className={`text-xs font-medium ${
                      run.status === "completed" ? "text-core-green" : "text-core-scarlet"
                    }`}
                  >
                    Run {run.status}
                  </p>
                  {run.step_results.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/10 bg-core-card p-2"
                    >
                      <p className="text-xs font-semibold text-neutral-200">
                        {i + 1}. {s.agentName}
                      </p>
                      {s.error ? (
                        <p className="mt-1 text-xs text-core-scarlet">{s.error}</p>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-400">
                          {s.output.slice(0, 600)}
                          {s.output.length > 600 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
