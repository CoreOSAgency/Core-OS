"use client";

import { agentSections, type Agent } from "@/lib/agents";

const TOOLS = [
  { label: "Meta Ads", soon: false },
  { label: "Google Ads", soon: false },
  { label: "Static Ads", soon: false },
  { label: "Landing Pages", soon: false },
  { label: "Lead Scraper", soon: false },
  { label: "Sales Pipeline", soon: true },
  { label: "Website Builder", soon: true },
  { label: "Ads Manager", soon: true },
];

export default function SecondaryNav({
  selectedAgentId,
  onSelectAgent,
  overviewActive,
  onOverview,
}: {
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  overviewActive: boolean;
  onOverview: () => void;
}) {
  return (
    <nav className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-core-nav">
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-neutral-100">Dashboard</h2>
      </div>

      <div className="px-2">
        <button
          onClick={onOverview}
          className={`mb-3 block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
            overviewActive
              ? "bg-core-purple/15 text-core-purple"
              : "text-neutral-300 hover:bg-white/5"
          }`}
        >
          Overview
        </button>
      </div>

      <div className="flex-1 space-y-4 px-2 pb-4">
        {agentSections.map((section) => (
          <div key={section.id}>
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">
              {section.title}
            </p>
            <ul>
              {section.agents.map((agent) => {
                const active = !overviewActive && agent.id === selectedAgentId;
                return (
                  <li key={agent.id}>
                    <button
                      onClick={() => onSelectAgent(agent)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                        active ? "bg-core-purple/15" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="text-sm">{agent.emoji}</span>
                      <span className={active ? "text-core-purple" : "text-neutral-100"}>
                        {agent.name}
                      </span>
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

        <div>
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">
            TOOLS
          </p>
          <ul>
            {TOOLS.map((tool) => (
              <li key={tool.label}>
                <button
                  disabled
                  title="Coming soon"
                  className="flex w-full cursor-default items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-neutral-500"
                >
                  {tool.label}
                  {tool.soon && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-neutral-500">
                      SOON
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
