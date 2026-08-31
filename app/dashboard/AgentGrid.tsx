"use client";

import { agentSections, type Agent } from "@/lib/agents";

const SECTION_ICON: Record<string, string> = {
  grow: "📈",
  create: "🎨",
  operate: "⚙️",
};

// None wired up yet — cards render disabled with a SOON badge rather than
// disappearing, so the roadmap stays visible without pretending to be live.
const TOOLS: { name: string; description: string; emoji: string; soon?: boolean }[] = [
  { name: "Meta Ads Media Buyer", description: "Manage Meta ad accounts and campaigns", emoji: "📢" },
  { name: "Google Ads Media Buyer", description: "Manage Google ad accounts and campaigns", emoji: "🎯" },
  { name: "Static Ads Generator", description: "Generate static ad creative", emoji: "🖼️" },
  { name: "Landing Page Builder", description: "Build and publish landing pages", emoji: "📄" },
  { name: "Website Builder", description: "Build full client websites", emoji: "🌐", soon: true },
  { name: "AI Video Editor", description: "Edit and generate video creative", emoji: "🎬", soon: true },
];

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
              <h2 className="text-sm font-semibold tracking-widest text-core-gold">
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
                className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-core-card p-5 text-left transition hover:border-core-gold/60 hover:bg-core-card/80"
              >
                <div className="flex flex-col items-start gap-3">
                  <span className="text-2xl">{agent.emoji}</span>
                  <div>
                    <h3 className="font-medium text-neutral-100 group-hover:text-core-gold">
                      {agent.name}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <span className="mt-1 text-neutral-700 transition group-hover:text-core-gold">
                  →
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm">🧰</span>
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-core-gold">TOOLS</h2>
            <p className="text-xs text-neutral-500">Standalone tools alongside the agent roster</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <div
              key={tool.name}
              title="Coming soon"
              className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-core-card p-5 opacity-60"
            >
              <div className="flex flex-col items-start gap-3">
                <span className="text-2xl">{tool.emoji}</span>
                <div>
                  <h3 className="font-medium text-neutral-100">{tool.name}</h3>
                  <p className="mt-1 text-xs text-neutral-500">{tool.description}</p>
                </div>
              </div>
              <span className="mt-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-neutral-500">
                SOON
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
