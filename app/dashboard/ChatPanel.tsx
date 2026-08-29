"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Agent } from "@/lib/agents";
import {
  extractTableData,
  hasSlideStructure,
  parseMarkdownToSlides,
} from "@/lib/markdownToBlocks";
import { downloadFileFromResponse } from "@/lib/download";

type ChatTurn = {
  role: "user" | "model";
  text: string;
  contextSaved?: boolean;
  isDeliverable?: boolean;
};

type ConversationSummary = { id: string; title: string | null; updated_at: string };

const SPREADSHEET_COMMAND = /export as spreadsheet|create a spreadsheet/i;

function deriveTitle(text: string, agentName: string): string {
  const heading = text.match(/^#{1,3}\s+(.*)$/m);
  return heading ? heading[1].trim() : `${agentName} notes`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function DriveButton({
  downloading,
  link,
  onClick,
}: {
  downloading: boolean;
  link?: string;
  onClick: () => void;
}) {
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10"
      >
        ✓ Open in Drive
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={downloading}
      className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
    >
      {downloading ? "Saving…" : "☁ Save to Drive"}
    </button>
  );
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
  table: (props: React.ComponentPropsWithoutRef<"table">) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props: React.ComponentPropsWithoutRef<"th">) => (
    <th
      className="border border-neutral-600 bg-neutral-900 px-2 py-1 text-left font-semibold"
      {...props}
    />
  ),
  td: (props: React.ComponentPropsWithoutRef<"td">) => (
    <td className="border border-neutral-700 px-2 py-1" {...props} />
  ),
};

type DriveFileType = "pdf" | "docx" | "xlsx" | "pptx";

export default function ChatPanel({
  agent,
  projectId,
  projectName,
  driveConnected,
  onClose,
}: {
  agent: Agent | null;
  projectId: string | null;
  projectName: string | null;
  driveConnected: boolean;
  onClose: () => void;
}) {
  const isOpen = agent !== null;
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ConversationSummary[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Opening a different agent — or a different project — resumes that
  // agent's most recent conversation for this project, if it has one.
  useEffect(() => {
    setInput("");
    setError(null);
    setShowHistory(false);
    setHistoryList(null);
    setMessages([]);
    setConversationId(null);
    setDriveLinks({});

    if (!agent || !projectId) return;

    setLoadingChat(true);
    fetch(`/api/projects/${projectId}/conversations?agentId=${agent.id}`)
      .then((res) => res.json())
      .then(async (data: { conversations?: ConversationSummary[] }) => {
        const latest = data.conversations?.[0];
        if (!latest) return;
        await loadConversation(latest.id);
      })
      .finally(() => setLoadingChat(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, showHistory]);

  async function loadConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const data = await res.json();
    const loaded: ChatTurn[] = (data.messages ?? []).map(
      (m: { role: "user" | "model"; content: string; context_saved: boolean; is_deliverable: boolean }) => ({
        role: m.role,
        text: m.content,
        contextSaved: m.context_saved,
        isDeliverable: m.is_deliverable,
      })
    );
    setMessages(loaded);
    setConversationId(id);
    setShowHistory(false);
  }

  async function openHistory() {
    if (!agent || !projectId) return;
    setShowHistory(true);
    const res = await fetch(`/api/projects/${projectId}/conversations?agentId=${agent.id}`);
    const data = await res.json();
    setHistoryList(data.conversations ?? []);
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
  }

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
        body: JSON.stringify({
          agentId: agent.id,
          message: text,
          projectId,
          conversationId,
          history,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error ?? "Something went wrong");

      if (data.conversationId) setConversationId(data.conversationId);

      const replyIndex = history.length + 1;
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: data.reply,
          contextSaved: data.contextSaved,
          isDeliverable: data.isDeliverable,
        },
      ]);

      if (SPREADSHEET_COMMAND.test(text)) {
        const tableData = extractTableData(data.reply);
        if (tableData) downloadSpreadsheet(replyIndex, tableData);
      }
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

  async function downloadSpreadsheet(index: number, data: Record<string, string>[]) {
    if (!agent) return;
    const key = `${index}-xlsx`;
    setDownloading(key);
    try {
      const res = await fetch("/api/generate/spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${agent.name} export`, data }),
      });
      if (!res.ok) throw new Error("Download failed");
      await downloadFileFromResponse(res, "spreadsheet.xlsx");
    } catch {
      setError("Couldn't generate that spreadsheet — try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadPresentation(index: number, text: string) {
    if (!agent) return;
    const key = `${index}-pptx`;
    setDownloading(key);
    try {
      const res = await fetch("/api/generate/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deriveTitle(text, agent.name),
          slides: parseMarkdownToSlides(text),
          projectName,
          agentName: agent.name,
        }),
      });
      if (!res.ok) throw new Error("Download failed");
      await downloadFileFromResponse(res, "presentation.pptx");
    } catch {
      setError("Couldn't generate that presentation — try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function saveToDrive(index: number, type: DriveFileType, text: string) {
    if (!agent) return;
    const key = `${index}-${type}-drive`;
    setDownloading(key);
    try {
      const body: Record<string, unknown> = {
        type,
        title: deriveTitle(text, agent.name),
        projectName,
        agentName: agent.name,
        projectId,
      };
      if (type === "pdf" || type === "docx") body.content = text;
      if (type === "xlsx") body.data = extractTableData(text);
      if (type === "pptx") body.slides = parseMarkdownToSlides(text);

      const res = await fetch("/api/generate/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save to Drive failed");
      setDriveLinks((prev) => ({ ...prev, [key]: data.webViewLink }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save to Drive — try again.");
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
        className={`fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-full flex-col border-l border-white/10 bg-core-nav shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {agent && (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.emoji}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-neutral-100">{agent.name}</h2>
                    <span className="rounded-full bg-core-purple/15 px-2 py-0.5 text-[10px] font-medium text-core-purple">
                      Agency
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">{agent.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewChat}
                  aria-label="New chat"
                  title="New chat"
                  className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                >
                  ✎
                </button>
                <button
                  onClick={() => (showHistory ? setShowHistory(false) : openHistory())}
                  aria-label="Chat history"
                  title="Chat history"
                  className={`rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100 ${
                    showHistory ? "bg-white/5 text-neutral-100" : ""
                  }`}
                >
                  🕘
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close chat"
                  className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {showHistory ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <button
                  onClick={startNewChat}
                  className="mb-3 w-full rounded-lg border border-core-purple px-3 py-2 text-left text-sm font-medium text-core-purple hover:bg-core-purple/10"
                >
                  + New chat
                </button>

                {historyList === null && (
                  <p className="text-sm text-neutral-500">Loading…</p>
                )}
                {historyList !== null && historyList.length === 0 && (
                  <p className="text-sm text-neutral-500">No past chats with {agent.name} yet.</p>
                )}
                <ul className="space-y-1">
                  {historyList?.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => loadConversation(c.id)}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
                          c.id === conversationId
                            ? "bg-white/5 text-neutral-100"
                            : "text-neutral-300"
                        }`}
                      >
                        <span className="block truncate">{c.title || "New chat"}</span>
                        <span className="text-xs text-neutral-500">
                          {relativeTime(c.updated_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {!loadingChat && messages.length === 0 && (
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
                        ? "ml-auto bg-core-purple text-white"
                        : "bg-core-card text-neutral-100"
                    }`}
                  >
                    {turn.role === "model" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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
                    {turn.role === "model" && turn.isDeliverable && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-700/60 pt-2">
                        <button
                          onClick={() => downloadDocument(i, turn.text, "pdf")}
                          disabled={downloading === `${i}-pdf`}
                          className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                        >
                          {downloading === `${i}-pdf` ? "Generating…" : "⬇ Download as PDF"}
                        </button>
                        {driveConnected && (
                          <DriveButton
                            downloading={downloading === `${i}-pdf-drive`}
                            link={driveLinks[`${i}-pdf-drive`]}
                            onClick={() => saveToDrive(i, "pdf", turn.text)}
                          />
                        )}
                        <button
                          onClick={() => downloadDocument(i, turn.text, "docx")}
                          disabled={downloading === `${i}-docx`}
                          className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                        >
                          {downloading === `${i}-docx` ? "Generating…" : "⬇ Download as Word Doc"}
                        </button>
                        {driveConnected && (
                          <DriveButton
                            downloading={downloading === `${i}-docx-drive`}
                            link={driveLinks[`${i}-docx-drive`]}
                            onClick={() => saveToDrive(i, "docx", turn.text)}
                          />
                        )}
                        {(() => {
                          const tableData = extractTableData(turn.text);
                          if (!tableData) return null;
                          return (
                            <>
                              <button
                                onClick={() => downloadSpreadsheet(i, tableData)}
                                disabled={downloading === `${i}-xlsx`}
                                className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                              >
                                {downloading === `${i}-xlsx`
                                  ? "Generating…"
                                  : "⬇ Download as Spreadsheet"}
                              </button>
                              {driveConnected && (
                                <DriveButton
                                  downloading={downloading === `${i}-xlsx-drive`}
                                  link={driveLinks[`${i}-xlsx-drive`]}
                                  onClick={() => saveToDrive(i, "xlsx", turn.text)}
                                />
                              )}
                            </>
                          );
                        })()}
                        {hasSlideStructure(turn.text) && (
                          <>
                            <button
                              onClick={() => downloadPresentation(i, turn.text)}
                              disabled={downloading === `${i}-pptx`}
                              className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                            >
                              {downloading === `${i}-pptx`
                                ? "Generating…"
                                : "⬇ Download as Presentation"}
                            </button>
                            {driveConnected && (
                              <DriveButton
                                downloading={downloading === `${i}-pptx-drive`}
                                link={driveLinks[`${i}-pptx-drive`]}
                                onClick={() => saveToDrive(i, "pptx", turn.text)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {sending && (
                  <div className="max-w-[85%] rounded-lg bg-core-card px-3 py-2 text-sm text-neutral-400">
                    {agent.name} is typing…
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            )}

            {!showHistory && (
              <div className="border-t border-white/10 p-4">
                <form onSubmit={sendMessage} className="flex items-center gap-2">
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
                    onChange={(e) => setInput(e.target.value)}
                    disabled={sending}
                    placeholder={`Message ${agent.name}…`}
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
                  {agent.name} has your whole agency context loaded.
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
