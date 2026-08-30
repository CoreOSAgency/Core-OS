"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

const STORAGE_KEY = "coreos_workflow";

type AgentNodeData = { agent: Agent };

function AgentNode({ data }: NodeProps) {
  const { agent } = data as unknown as AgentNodeData;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-core-card px-3 py-2 shadow-lg">
      <span className="text-lg">{agent.emoji}</span>
      <span className="text-sm font-medium text-neutral-100">{agent.name}</span>
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

function loadInitial(): { nodes: Node[]; edges: Edge[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage unavailable or corrupt — start empty
  }
  return { nodes: [], edges: [] };
}

export default function WorkflowsPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const nextPos = useRef({ x: 80, y: 80 });

  useEffect(() => {
    const { nodes: n, edges: e } = loadInitial();
    setNodes(n);
    setEdges(e);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    } catch {
      // per-browser convenience only — fine if this silently fails
    }
  }, [nodes, edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  function addAgent(agent: Agent) {
    const pos = { ...nextPos.current };
    nextPos.current = { x: pos.x + 40, y: pos.y + 90 };
    setNodes((nds) => [
      ...nds,
      {
        id: `${agent.id}-${Date.now()}`,
        type: "agent",
        position: pos,
        data: { agent },
      },
    ]);
  }

  function clearCanvas() {
    setNodes([]);
    setEdges([]);
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-white/5 bg-core-nav p-3">
        <h2 className="mb-1 px-1 text-sm font-semibold text-neutral-100">Workflows</h2>
        <p className="mb-4 px-1 text-xs text-neutral-500">
          Click an agent to add it, then drag between nodes to connect a pipeline.
        </p>
        {agentSections.map((section) => (
          <div key={section.id} className="mb-4">
            <p className="px-1 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">
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
          className="mt-2 w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5"
        >
          Clear canvas
        </button>
      </aside>

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
    </div>
  );
}
