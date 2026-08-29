"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Agent } from "@/lib/agents";
import { countWords, hasStructuredContent } from "@/lib/markdownToBlocks";
import { downloadFileFromResponse } from "@/lib/download";

type ChatTurn = { role: "user" | "model"; text: string; contextSaved?: boolean };

function deriveTitle(text: string, agentName: string): string {
  const heading = text.match(/^#{1,3}\s+(.*)$/m);
  return heading ? heading[1].trim() : `${agentName} notes`;
}

// Tight, dark-theme-matched overrides — markdown's default block spacing is
// too loose for a chat bubble at text-sm.
const markdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0" {...props} />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0" {...props} />
  ),
  h1: (props: React.ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mb-1 mt-2 text-base font-semibold first:mt-0" {...props} />
  ),
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mb-1 mt-2 text-sm font-semibold first:mt-0" {...props} />
  ),
  h3: (props: React.ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0" {...props} />
  ),
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold" {...props} />
  ),
  code: (props: React.ComponentPropsWithoutRef<"code">) => (
    <code className="rounded bg-black/30 px-1 py-0.5 text-xs" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a className="underline hover:text-emerald-400" target="_blank" rel="noreferrer" {...props} />
  ),
};

export default function ChatPanel({
  agent,
  projectId,
  projectName,
  onClose,
}: {
  agent: Agent | null;
  projectId: string | null;
  projectName: string | null;
  onClose: () => void;
}) {
  const isOpen = agent !== null;
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever a different agent — or a different
  // project — is opened. Switching projects means different context.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [agent?.id, projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !agent || !projectId || sending) return;

    const history = messages;
    setMessages([...history, { role: "user", text }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, message: text, projectId, history }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");

      setMessages((prev) => [
        ...prev,
        { role: "model", text: data.reply, contextSaved: data.contextSaved },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function downloadDocument(index: number, text: string, type: "pdf" | "docx") {
    if (!agent) return;
    const key = `${index}-${type}`;
    setDownloading(key);
    try {
      const res = await fetch("/api/generate/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: deriveTitle(text, agent.name),
          content: text,
          projectName,
          agentName: agent.name,
        }),
      });
      if (!res.ok) throw new Error("Download failed");
      await downloadFileFromResponse(res, `document.${type}`);
    } catch {
      setError("Couldn't generate that document — try again.");
    } finally {
      setDownloading(null);
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
                  {turn.role === "model" ? (
                    <ReactMarkdown components={markdownComponents}>
                      {turn.text}
                    </ReactMarkdown>
                  ) : (
                    turn.text
                  )}
                  {turn.contextSaved && (
                    <p className="mt-1.5 text-xs text-emerald-400/80">
                      ✓ Project memory saved
                    </p>
                  )}
                  {turn.role === "model" &&
                    (countWords(turn.text) > 300 || hasStructuredContent(turn.text)) && (
                      <div className="mt-2 flex flex-wrap gap-2 border-t border-neutral-700/60 pt-2">
                        <button
                          onClick={() => downloadDocument(i, turn.text, "pdf")}
                          disabled={downloading === `${i}-pdf`}
                          className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                        >
                          {downloading === `${i}-pdf` ? "Generating…" : "⬇ Download as PDF"}
                        </button>
                        <button
                          onClick={() => downloadDocument(i, turn.text, "docx")}
                          disabled={downloading === `${i}-docx`}
                          className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                        >
                          {downloading === `${i}-docx` ? "Generating…" : "⬇ Download as Word Doc"}
                        </button>
                      </div>
                    )}
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
