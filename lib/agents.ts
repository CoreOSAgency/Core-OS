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
      { id: "lead-finder", name: "Lead Finder", description: "Sources and qualifies new leads", emoji: "🎯" },
      { id: "outreach-pilot", name: "Outreach Pilot", description: "Drafts and sequences cold outreach", emoji: "📨" },
      { id: "seo-strategist", name: "SEO Strategist", description: "Plans keyword and content strategy", emoji: "📈" },
      { id: "ad-optimizer", name: "Ad Optimizer", description: "Tunes paid campaign performance", emoji: "💸" },
    ],
  },
  {
    id: "create",
    title: "CREATE",
    description: "Content, copy, and creative production",
    agents: [
      { id: "copywriter", name: "Copywriter", description: "Writes landing pages and ad copy", emoji: "✍️" },
      { id: "content-planner", name: "Content Planner", description: "Builds content calendars and briefs", emoji: "🗓️" },
      { id: "brand-designer", name: "Brand Designer", description: "Generates visual concepts and assets", emoji: "🎨" },
      { id: "video-scripter", name: "Video Scripter", description: "Writes scripts for short-form video", emoji: "🎬" },
    ],
  },
  {
    id: "operate",
    title: "OPERATE",
    description: "Client ops, reporting, and delivery",
    agents: [
      { id: "client-reporter", name: "Client Reporter", description: "Compiles client performance reports", emoji: "📊" },
      { id: "task-manager", name: "Task Manager", description: "Tracks deliverables and deadlines", emoji: "✅" },
      { id: "invoice-assistant", name: "Invoice Assistant", description: "Drafts invoices and follows up on payment", emoji: "🧾" },
      { id: "meeting-notetaker", name: "Meeting Notetaker", description: "Summarizes calls into action items", emoji: "📝" },
    ],
  },
];
