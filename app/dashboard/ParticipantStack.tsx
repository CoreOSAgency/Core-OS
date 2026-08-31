"use client";

import { findAgent } from "@/lib/agents";

// Stacked agent emoji for a multi-participant conversation in a history list.
// Renders nothing for a single-agent thread.
export default function ParticipantStack({ agentIds }: { agentIds?: string[] }) {
  const agents = (agentIds ?? [])
    .map((id) => findAgent(id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (agents.length < 2) return null;
  return (
    <span className="flex -space-x-1.5">
      {agents.slice(0, 4).map((a) => (
        <span
          key={a.id}
          title={a.name}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-core-card bg-core-nav text-[10px]"
        >
          {a.emoji}
        </span>
      ))}
    </span>
  );
}
