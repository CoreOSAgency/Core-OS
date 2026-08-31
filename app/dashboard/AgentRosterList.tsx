"use client";

import { agentSections, findAgent, type Agent } from "@/lib/agents";
import type { Conversation } from "@/lib/conversations";

// The GROW/CREATE/OPERATE grouped agent list - shared between SecondaryNav
// (Agency Overview's sidebar) and the agent chat page's roster panel, so the
// two never drift apart. When `groups` is passed it also renders a
// "GROUP CHATS" section below the roster.
export default function AgentRosterList({
  selectedAgentId,
  onSelectAgent,
  groups,
  activeGroupId,
  onSelectGroup,
  onNewGroup,
}: {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  groups?: Conversation[];
  activeGroupId?: string | null;
  onSelectGroup?: (id: string) => void;
  onNewGroup?: () => void;
}) {
  return (
    <div className="space-y-4">
      {agentSections.map((group) => (
        <div key={group.id}>
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-core-gold">
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
                      {agent.description.split(" - ")[0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {groups !== undefined && (
        <div>
          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-[10px] font-semibold tracking-widest text-core-gold">GROUP CHATS</p>
            {onNewGroup && (
              <button
                onClick={onNewGroup}
                title="New group chat"
                className="text-xs text-core-purple hover:underline"
              >
                +
              </button>
            )}
          </div>
          {groups.length === 0 ? (
            <p className="px-3 text-xs text-neutral-600">None yet. Type @ in a chat to start one.</p>
          ) : (
            <ul>
              {groups.map((g) => {
                const active = g.id === activeGroupId;
                return (
                  <li key={g.id}>
                    <button
                      onClick={() => onSelectGroup?.(g.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                        active ? "bg-core-purple/15" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="flex -space-x-1">
                        {g.participant_agent_ids.slice(0, 3).map((id) => (
                          <span key={id} className="text-xs">
                            {findAgent(id)?.emoji ?? "•"}
                          </span>
                        ))}
                      </span>
                      <span
                        className={`truncate ${active ? "text-core-purple" : "text-neutral-100"}`}
                      >
                        {g.title || "Group chat"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
