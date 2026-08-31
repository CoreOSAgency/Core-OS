"use client";

import { agentSections, type Agent } from "@/lib/agents";

// The GROW/CREATE/OPERATE grouped agent list — shared between SecondaryNav
// (Agency Overview's sidebar) and the agent chat page's roster panel, so the
// two never drift apart.
export default function AgentRosterList({
  selectedAgentId,
  onSelectAgent,
}: {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
}) {
  return (
    <div className="space-y-4">
      {agentSections.map((group) => (
        <div key={group.id}>
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-core-gold/70">
            {group.title}
          </p>
          <ul>
            {group.agents.map((agent) => {
              const active = agent.id === selectedAgentId;
              return (
                <li key={agent.id}>
                  <button
                    onClick={() => onSelectAgent(agent)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                      active ? "bg-core-purple/15" : "hover:bg-white/5"
                    }`}
                  >
                    <span className="text-sm">{agent.emoji}</span>
                    <span className={active ? "text-core-purple" : "text-neutral-100"}>{agent.name}</span>
                    <span className="text-neutral-700">·</span>
                    <span className="truncate text-xs text-neutral-500">
                      {agent.description.split(" — ")[0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
