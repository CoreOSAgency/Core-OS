export type Agent = {
  id: string;
  name: string;
  description: string;
  emoji: string;
};

export type AgentSection = {
  id: "grow" | "create" | "operate";
  title: string;
  description: string;
  agents: Agent[];
};

export const agentSections: AgentSection[] = [
  {
    id: "grow",
    title: "GROW",
    description: "Pipeline, outreach, and acquisition",
    agents: [
      { id: "rex", name: "Rex", description: "Sales expert — closes deals and coaches the sales process", emoji: "🤝" },
      { id: "sage", name: "Sage", description: "Marketing expert — strategy and client acquisition", emoji: "🧠" },
      { id: "kai", name: "Kai", description: "Lead gen — sources and qualifies new leads", emoji: "🎯" },
      { id: "nova", name: "Nova", description: "Ads specialist — Meta ads and paid campaigns", emoji: "📢" },
      { id: "flynn", name: "Flynn", description: "Cold outreach — email and DM outreach systems", emoji: "📨" },
      { id: "juno", name: "Juno", description: "Content expert — content strategy and personal branding", emoji: "🎬" },
    ],
  },
  {
    id: "create",
    title: "CREATE",
    description: "Content, copy, and creative production",
    agents: [
      { id: "axel", name: "Axel", description: "Systems architect — AI systems and tech architecture", emoji: "⚙️" },
      { id: "iris", name: "Iris", description: "Design consultant — brand identity and visual creative", emoji: "🎨" },
      { id: "echo", name: "Echo", description: "Copywriter — direct response and ad copy", emoji: "✍️" },
      { id: "forge", name: "Forge", description: "Funnel builder — GHL funnels and landing pages", emoji: "🛠️" },
    ],
  },
  {
    id: "operate",
    title: "OPERATE",
    description: "Client ops, reporting, and delivery",
    agents: [
      { id: "atlas", name: "Atlas", description: "Business strategist — scaling and growth strategy", emoji: "🧭" },
      { id: "vera", name: "Vera", description: "Hiring specialist — recruitment and team building", emoji: "🧑‍💼" },
      { id: "lex", name: "Lex", description: "Legal assistant — compliance and contracts", emoji: "⚖️" },
      { id: "cleo", name: "Cleo", description: "Client comms — retention and client relationships", emoji: "💬" },
      { id: "zen", name: "Zen", description: "Mindset coach — performance and productivity", emoji: "🧘" },
    ],
  },
];
