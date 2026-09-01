"use client";

import { useEffect, useState } from "react";
import { shouldUseTools, type ChatMode } from "@/lib/modelRouter";
import type { StreamActivity } from "@/lib/useAgentChat";

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
  activity = [],
}: {
  agentName: string;
  mode: ChatMode;
  lastMessage?: string;
  activity?: StreamActivity[];
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
    activity.length > 0
      ? activity[activity.length - 1].type === "search"
        ? "Searching the web"
        : "Reading sources"
      : phase === 0 && !researching
        ? `${agentName} is thinking`
        : phases[Math.min(phase, phases.length - 1)][0];

  const recent = activity.slice(-4);

  return (
    <div className="inline-flex max-w-[85%] flex-col gap-1.5 rounded-lg bg-core-card px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full sunbird-band think-pulse" />
        <span className="shimmer-text text-sm font-medium">{label}</span>
      </div>
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-5">
          {recent.map((a, i) => (
            <span
              key={`${a.type}-${a.value}-${i}`}
              className="max-w-[240px] truncate rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-xs text-neutral-400"
              title={a.value}
            >
              {a.type === "search" ? "🔍 " : "📄 "}
              {a.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
