"use client";

import { useMemo, useState } from "react";
import { agentSections, type Agent } from "@/lib/agents";
import type { ChatMode } from "@/lib/modelRouter";

const MODE_LABELS: [ChatMode, string][] = [
  ["quick", "Quick"],
  ["standard", "Standard"],
  ["deep", "Deep Research"],
];

const ALL_AGENTS = agentSections.flatMap((s) => s.agents);

export default function ChatComposer({
  agentName,
  input,
  onInputChange,
  onSubmit,
  sending,
  mode,
  onModeChange,
  isGroup,
  participants,
  activeAgentId,
  onSelectAgent,
  onAddParticipant,
  onRemoveParticipant,
  onMention,
}: {
  agentName: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  sending: boolean;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  isGroup: boolean;
  participants: Agent[];
  activeAgentId?: string;
  onSelectAgent: (a: Agent) => void;
  onAddParticipant: (a: Agent) => void;
  onRemoveParticipant: (a: Agent) => void;
  // 1:1 -> fork to a new group with this agent; group -> add/switch to them.
  onMention: (a: Agent) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // "@jun" at the end of the input opens the mention menu.
  const mentionQuery = useMemo(() => {
    const m = input.match(/@(\w*)$/);
    return m ? m[1].toLowerCase() : null;
  }, [input]);
  const mentionMatches =
    mentionQuery === null
      ? []
      : ALL_AGENTS.filter((a) => a.name.toLowerCase().startsWith(mentionQuery)).slice(0, 6);

  function pickMention(a: Agent) {
    onInputChange(input.replace(/@\w*$/, isGroup ? `@${a.name} ` : ""));
    onMention(a);
  }

  const inThread = new Set(participants.map((p) => p.id));

  return (
    <div className="border-t border-white/10 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isGroup &&
          participants.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1 rounded-full py-1 pl-2 pr-1 text-[11px] font-medium ${
                p.id === activeAgentId
                  ? "bg-core-teal text-[#05221f]"
                  : "bg-white/5 text-neutral-300"
              }`}
            >
              <button type="button" onClick={() => onSelectAgent(p)} className="flex items-center gap-1">
                <span>{p.emoji}</span>
                {p.name}
              </button>
              {participants.length > 1 && (
                <button
                  type="button"
                  title={`Remove ${p.name}`}
                  onClick={() => onRemoveParticipant(p)}
                  className="rounded-full px-1 opacity-70 hover:text-core-scarlet hover:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          ))}

        {isGroup && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Add an agent to this chat"
              className="flex h-6 items-center rounded-full border border-white/10 px-2 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            >
              + Agent
            </button>
            {pickerOpen && (
              <div className="absolute bottom-8 left-0 z-30 max-h-72 w-56 overflow-y-auto rounded-lg border border-white/10 bg-core-card p-2 shadow-xl">
                {agentSections.map((section) => (
                  <div key={section.id} className="mb-2 last:mb-0">
                    <p className="px-1 pb-1 text-[10px] font-semibold tracking-widest text-core-amber">
                      {section.title}
                    </p>
                    {section.agents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        disabled={inThread.has(a.id)}
                        onClick={() => {
                          onAddParticipant(a);
                          setPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-40"
                      >
                        <span>{a.emoji}</span>
                        <span className="truncate">{a.name}</span>
                        {inThread.has(a.id) && (
                          <span className="ml-auto text-[10px] text-neutral-500">in chat</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="flex-1" />

        <div className="flex w-fit gap-0.5 rounded-lg border border-white/10 p-0.5">
          {MODE_LABELS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mode === m
                  ? "bg-core-purple text-[#111214]"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(input);
        }}
        className="relative flex items-center gap-2"
      >
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-11 left-10 z-30 w-56 overflow-hidden rounded-lg border border-white/10 bg-core-card shadow-xl">
            {mentionMatches.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pickMention(a)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5"
              >
                <span>{a.emoji}</span>
                {a.name}
                {!isGroup && <span className="ml-auto text-[10px] text-neutral-500">new group</span>}
              </button>
            ))}
          </div>
        )}
        {/* ponytail: paperclip/mic are decorative - no attachment or voice backend yet */}
        <button
          type="button"
          disabled
          title="Attachments coming soon"
          className="flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-lg text-neutral-600"
        >
          📎
        </button>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={sending}
          placeholder={isGroup ? `Message ${agentName}… (@ to add an agent)` : `Message ${agentName}… (@ for a group chat)`}
          className="w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-core-purple disabled:opacity-60"
        />
        <button
          type="button"
          disabled
          title="Voice input coming soon"
          className="flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-lg text-neutral-600"
        >
          🎤
        </button>
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-[#111214] transition hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Send
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-neutral-600">
        {isGroup ? "Group chat" : `${agentName} has your whole agency context loaded.`}
      </p>
    </div>
  );
}
