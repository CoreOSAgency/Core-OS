"use client";

import { agentSections, type Agent } from "@/lib/agents";

const SECTION_ICON: Record<string, string> = {
  grow: "📈",
  create: "🎨",
  operate: "⚙️",
};

export default function AgentGrid({
  onSelect,
}: {
  onSelect: (agent: Agent) => void;
}) {
  return (
    <div className="space-y-10">
      {agentSections.map((section) => (
        <section key={section.id}>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm">{SECTION_ICON[section.id]}</span>
            <div>
              <h2 className="text-sm font-semibold tracking-widest text-neutral-400">
                {section.title}
              </h2>
              <p className="text-xs text-neutral-500">{section.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {section.agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-core-card p-5 text-left transition hover:border-core-purple/50 hover:bg-core-card/80"
              >
                <div className="flex flex-col items-start gap-3">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div>
                    <h3 className="font-medium text-neutral-100 group-hover:text-core-purple">
                      {agent.name}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <span className="mt-1 text-neutral-700 transition group-hover:text-core-purple">
                  →
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
