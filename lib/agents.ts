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

// ids are stable (used as the agent_id foreign key on stored conversations) -
// only display names/order/emoji move when the roster is rebranded.
export const agentSections: AgentSection[] = [
  {
    id: "grow",
    title: "GROW",
    description: "Pipeline, outreach, and acquisition",
    agents: [
      { id: "rex", name: "Rex", description: "Sales expert - closes deals and coaches the sales process", emoji: "🤝" },
      { id: "sage", name: "Sage", description: "Marketing expert - strategy and client acquisition", emoji: "🧠" },
      { id: "nova", name: "Mia", description: "Ads specialist - Meta ads and paid campaigns", emoji: "📢" },
      { id: "kai", name: "Kai", description: "Lead gen - sources and qualifies new leads", emoji: "🎯" },
      { id: "flynn", name: "Flynn", description: "Cold outreach - email and DM outreach systems", emoji: "📨" },
      { id: "juno", name: "Juno", description: "Content expert - content strategy and personal branding", emoji: "🎬" },
    ],
  },
  {
    id: "create",
    title: "CREATE",
    description: "Content, copy, and creative production",
    agents: [
      { id: "axel", name: "Axel", description: "Systems architect - AI systems and tech architecture", emoji: "⚙️" },
      { id: "iris", name: "Iris", description: "Design consultant - brand identity and visual creative", emoji: "🎨" },
      { id: "echo", name: "Echo", description: "Copywriter - direct response and ad copy", emoji: "✍️" },
      { id: "forge", name: "Forge", description: "Funnel builder - GHL funnels and landing pages", emoji: "🛠️" },
    ],
  },
  {
    id: "operate",
    title: "OPERATE",
    description: "Client ops, reporting, and delivery",
    agents: [
      { id: "atlas", name: "Ava", description: "Business strategist - scaling and growth strategy", emoji: "🧭" },
      { id: "vera", name: "Vera", description: "Hiring specialist - recruitment and team building", emoji: "🧑‍💼" },
      { id: "lex", name: "Lex", description: "Legal assistant - compliance and contracts", emoji: "⚖️" },
      { id: "cleo", name: "Cleo", description: "Client comms - retention and client relationships", emoji: "💬" },
      { id: "zen", name: "Zen", description: "Mindset coach - performance and productivity", emoji: "🧘" },
    ],
  },
];

// The general assistant - not part of a GROW/CREATE/OPERATE section, always
// available from the Dashboard's right panel.
export const CORE_AGENT: Agent = {
  id: "core",
  name: "Core",
  description: "General Assistant - navigates CoreOS, adds clients, routes you to the right specialist",
  emoji: "🧬",
};

export function findAgent(agentId: string): Agent | null {
  if (agentId === CORE_AGENT.id) return CORE_AGENT;
  for (const section of agentSections) {
    const agent = section.agents.find((a) => a.id === agentId);
    if (agent) return agent;
  }
  return null;
}

// Default name for a group chat, e.g. "Rex, Juno & Echo".
export function groupName(agentIds: string[]): string {
  const names = agentIds.map((id) => findAgent(id)?.name).filter(Boolean) as string[];
  if (names.length === 0) return "Group chat";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// Four starting prompts per agent for the full chat page's empty state.
export const AGENT_PROMPTS: Record<string, string[]> = {
  rex: [
    "Help me handle a price objection",
    "Build me a sales call script",
    "Review my closing process",
    "What should I say when a lead goes cold?",
  ],
  sage: [
    "Build me a client acquisition plan",
    "Review my marketing funnel",
    "What channel should I focus on?",
    "Audit my messaging",
  ],
  nova: [
    "Plan a Meta ad campaign",
    "Review my ad account structure",
    "Write ad copy for a new offer",
    "Diagnose underperforming ads",
  ],
  kai: [
    "Build me a lead list strategy",
    "Find lead sources for my niche",
    "Set up a lead scoring system",
    "Improve my lead quality",
  ],
  flynn: [
    "Write a cold email sequence",
    "Build a DM outreach script",
    "Plan my outbound volume",
    "Improve my reply rate",
  ],
  juno: [
    "Plan my content calendar",
    "Write hooks for a video",
    "Build my personal brand strategy",
    "Plan a platform posting cadence",
  ],
  axel: [
    "Design an AI system for a client",
    "Explain the 3-layer AI OS architecture",
    "Price an AI system offer",
    "Plan a Daily Brief for my agency",
  ],
  iris: [
    "Build brand guidelines for a client",
    "Design a still ad creative brief",
    "Review my agency's visual identity",
    "Plan a logo refresh",
  ],
  echo: [
    "Write ad copy for my offer",
    "Write a cold email opener",
    "Write landing page copy",
    "Punch up this headline",
  ],
  forge: [
    "Build a funnel for my offer",
    "Set up GHL sub-account structure",
    "Plan a lead magnet funnel",
    "Diagnose a low-converting funnel",
  ],
  atlas: [
    "What scaling phase am I in?",
    "Build me a 90-day growth plan",
    "Review my agency's Tree Model",
    "Set my next SMART goal",
  ],
  vera: [
    "Write a job description",
    "Plan my recruitment funnel",
    "Design a Pod structure",
    "Set compensation for a new hire",
  ],
  lex: [
    "Review my service agreement terms",
    "What insurance do I need?",
    "Explain GDPR basics for my agency",
    "Draft an NDA",
  ],
  cleo: [
    "Write a client check-in message",
    "Plan my reporting cadence",
    "Handle an unhappy client",
    "Ask for a testimonial",
  ],
  zen: [
    "Help me plan my week",
    "I'm stuck in the Valley of Despair",
    "Build me a morning routine",
    "Help me stop procrastinating",
  ],
};
