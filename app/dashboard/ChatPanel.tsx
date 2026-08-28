"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/agents";

type ChatTurn = { role: "user" | "model"; text: string };

export default function ChatPanel({
  agent,
  onClose,
}: {
  agent: Agent | null;
  onClose: () => void;
}) {
  const isOpen = agent !== null;
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever a different agent is opened.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [agent?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !agent || sending) return;

    const history = messages;
    setMessages([...history, { role: "user", text }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, message: text, history }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");

      setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

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

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="text-3xl">{agent.emoji}</span>
                  <p className="text-sm text-neutral-400">
                    Message {agent.name} to get started.
                  </p>
                </div>
              )}

              {messages.map((turn, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    turn.role === "user"
                      ? "ml-auto bg-emerald-600 text-white"
                      : "bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {turn.text}
                </div>
              ))}

              {sending && (
                <div className="max-w-[85%] rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-400">
                  {agent.name} is typing…
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <form onSubmit={sendMessage} className="border-t border-neutral-800 p-4">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                  placeholder={`Message ${agent.name}…`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-500 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </>
  );
}
