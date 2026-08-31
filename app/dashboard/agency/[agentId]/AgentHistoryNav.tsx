"use client";

import { useState } from "react";
import type { Agent } from "@/lib/agents";
import { relativeTime, type ConversationSummary } from "@/lib/useAgentChat";
import ParticipantStack from "../../ParticipantStack";

export default function AgentHistoryNav({
  agent,
  history,
  activeConversationId,
  onNewChat,
  onSelectConversation,
}: {
  agent: Agent;
  history: ConversationSummary[] | null;
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = (history ?? []).filter((c) =>
    (c.title ?? "New chat").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <nav className="flex h-full min-h-0 w-[200px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-core-nav">
      <div className="px-4 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
          <span>{agent.emoji}</span> {agent.name}
        </h2>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">History</p>
      </div>

      <div className="px-2">
        <button
          onClick={onNewChat}
          className="mb-2 block w-full rounded-lg border border-core-purple px-3 py-2 text-left text-sm font-medium text-core-purple hover:bg-core-purple/10"
        >
          + New chat
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          className="mb-3 w-full rounded-lg border border-white/10 bg-core-main px-3 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-core-purple"
        />
      </div>

      <div className="flex-1 space-y-0.5 px-2 pb-4">
        {history === null && <p className="px-1 text-sm text-neutral-500">Loading…</p>}
        {history !== null && filtered.length === 0 && (
          <p className="px-1 text-sm text-neutral-600">
            {history.length === 0 ? `No past chats with ${agent.name} yet.` : "No matches."}
          </p>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectConversation(c.id)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
              c.id === activeConversationId ? "bg-white/5 text-neutral-100" : "text-neutral-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="block flex-1 truncate">{c.title || "New chat"}</span>
              <ParticipantStack agentIds={c.participant_agent_ids} />
            </span>
            <span className="text-xs text-neutral-500">{relativeTime(c.updated_at)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
