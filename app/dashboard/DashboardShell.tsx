"use client";

import { useState } from "react";
import type { Agent } from "@/lib/agents";
import AgentGrid from "./AgentGrid";
import ChatPanel from "./ChatPanel";

export default function DashboardShell() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <>
      <AgentGrid onSelect={setSelectedAgent} />
      <ChatPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </>
  );
}
