"use client";

import { agentSections, type Agent } from "@/lib/agents";

export default function AgentGrid({
  onSelect,
}: {
  onSelect: (agent: Agent) => void;
}) {
  return (
    <div className="space-y-10">
      {agentSections.map((section) => (
        <section key={section.id}>
          <div className="mb-4">
            <h2 className="text-sm font-semibold tracking-widest text-neutral-400">
              {section.title}
            </h2>
            <p className="text-xs text-neutral-500">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {section.agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                className="group flex flex-col items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 text-left transition hover:border-neutral-700 hover:bg-neutral-900"
              >
                <span className="text-2xl">{agent.emoji}</span>
                <div>
                  <h3 className="font-medium text-neutral-100 group-hover:text-white">
                    {agent.name}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {agent.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
