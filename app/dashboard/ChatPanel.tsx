"use client";

import type { Agent } from "@/lib/agents";

export default function ChatPanel({
  agent,
  onClose,
}: {
  agent: Agent | null;
  onClose: () => void;
}) {
  const isOpen = agent !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-neutral-900 shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {agent && (
          <>
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.emoji}</span>
                <div>
                  <h2 className="font-semibold text-neutral-100">{agent.name}</h2>
                  <p className="text-xs text-neutral-400">{agent.description}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close chat"
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="text-3xl">{agent.emoji}</span>
              <p className="text-sm text-neutral-400">
                {agent.name} isn&apos;t wired up yet — agent logic is coming
                soon.
              </p>
            </div>

            <div className="border-t border-neutral-800 p-4">
              <div className="flex items-center gap-2">
                <input
                  disabled
                  placeholder={`Message ${agent.name}…`}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-500 placeholder:text-neutral-600"
                />
                <button
                  disabled
                  className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-500"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
