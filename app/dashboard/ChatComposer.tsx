"use client";

export default function ChatComposer({
  agentName,
  input,
  onInputChange,
  onSubmit,
  sending,
}: {
  agentName: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  sending: boolean;
}) {
  return (
    <div className="border-t border-white/10 p-4">
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
          className="shrink-0 rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-white transition hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
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
