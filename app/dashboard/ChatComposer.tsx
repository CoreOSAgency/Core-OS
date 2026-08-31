"use client";

import type { ChatMode } from "@/lib/modelRouter";

const MODE_LABELS: [ChatMode, string][] = [
  ["quick", "Quick"],
  ["standard", "Standard"],
  ["deep", "Deep Research"],
];

export default function ChatComposer({
  agentName,
  input,
  onInputChange,
  onSubmit,
  sending,
  mode,
  onModeChange,
}: {
  agentName: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  sending: boolean;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
}) {
  return (
    <div className="border-t border-white/10 p-4">
      <div className="mb-2 flex w-fit gap-0.5 rounded-lg border border-white/10 p-0.5">
        {MODE_LABELS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              mode === m
                ? "bg-core-purple text-[#04170d]"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(input);
        }}
        className="flex items-center gap-2"
      >
        {/* ponytail: paperclip/mic are decorative — no attachment or voice backend yet */}
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
          placeholder={`Message ${agentName}…`}
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
          className="shrink-0 rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-[#04170d] transition hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Send
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-neutral-600">
        {agentName} has your whole agency context loaded.
      </p>
    </div>
  );
}
