"use client";

import { useEffect, useState } from "react";
import { shouldUseTools, type ChatMode } from "@/lib/modelRouter";

// Phases the label steps through while the agent works. Timings are rough - the
// real response length varies - they just keep the text alive so a 30s research
// wait doesn't look frozen.
const RESEARCH_PHASES: [string, number][] = [
  ["Thinking", 0],
  ["Searching the web", 2600],
  ["Reading sources", 8000],
  ["Writing the answer", 15000],
];
const PLAIN_PHASES: [string, number][] = [
  ["Thinking", 0],
  ["Writing the answer", 4000],
];

export default function ThinkingIndicator({
  agentName,
  mode,
  lastMessage,
}: {
  agentName: string;
  mode: ChatMode;
  lastMessage?: string;
}) {
  const researching = mode === "deep" || shouldUseTools(mode, lastMessage ?? "");
  const phases = researching ? RESEARCH_PHASES : PLAIN_PHASES;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setPhase(0);
    const timers = phases
      .map(([, at], i) =>
        at === 0 ? null : window.setTimeout(() => setPhase(i), at)
      )
      .filter((t): t is number => t !== null);
    return () => timers.forEach(clearTimeout);
  }, [phases]);

  const label =
    phase === 0 && !researching
      ? `${agentName} is thinking`
      : phases[Math.min(phase, phases.length - 1)][0];

  return (
    <div className="inline-flex max-w-[85%] items-center gap-2.5 rounded-lg bg-core-card px-3 py-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full sunbird-band think-pulse" />
      <span className="shimmer-text text-sm font-medium">{label}</span>
    </div>
  );
}
