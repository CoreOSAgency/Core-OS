"use client";

import type { Agent } from "@/lib/agents";
import AgentRosterList from "../../AgentRosterList";

// Panel 2 on the agent chat page — the full roster, always visible, so
// switching agents never means going back to the dashboard first.
export default function AgentRosterNav({
  selectedAgentId,
  onSelectAgent,
}: {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
}) {
  return (
    <nav className="flex h-full min-h-0 w-[200px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-core-nav px-2 py-4">
      <AgentRosterList selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />
    </nav>
  );
}
