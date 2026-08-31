"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "@/lib/agents";
import type { ChatMode } from "@/lib/modelRouter";
import { CHAT_MODE_KEY } from "@/lib/localStorageKeys";
import { extractTableData, parseMarkdownToSlides } from "@/lib/markdownToBlocks";
import { downloadFileFromResponse } from "@/lib/download";

export type GroundingSource = { title: string; url: string };

export type ChatTurn = {
  role: "user" | "model";
  text: string;
  contextSaved?: boolean;
  isDeliverable?: boolean;
  groundingSources?: GroundingSource[];
};

const CHAT_MODES: ChatMode[] = ["quick", "standard", "deep"];

export type ConversationSummary = { id: string; title: string | null; updated_at: string };

const SPREADSHEET_COMMAND = /export as spreadsheet|create a spreadsheet/i;

export function deriveTitle(text: string, agentName: string): string {
  const heading = text.match(/^#{1,3}\s+(.*)$/m);
  return heading ? heading[1].trim() : `${agentName} notes`;
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type DriveFileType = "pdf" | "docx" | "xlsx" | "pptx";

// Shared by ChatPanel (slide-over), CorePanel (Dashboard right rail), and the
// full-page agent chat route — one implementation of send/history/downloads
// instead of three copies drifting apart.
export function useAgentChat({
  agent,
  projectId,
  projectName,
  driveConnected,
}: {
  agent: Agent | null;
  projectId: string | null;
  projectName: string | null;
  driveConnected: boolean;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [mode, setModeState] = useState<ChatMode>("standard");
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

  // Last-selected mode is a per-browser preference — persists across agents,
  // projects, and reloads.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_MODE_KEY);
      if (saved && (CHAT_MODES as string[]).includes(saved)) {
        setModeState(saved as ChatMode);
      }
    } catch {
      // per-browser convenience only
    }
  }, []);

  function setMode(next: ChatMode) {
    setModeState(next);
    try {
      localStorage.setItem(CHAT_MODE_KEY, next);
    } catch {
      // per-browser convenience only
    }
  }

  // Switching agent or project resumes that agent's most recent conversation
  // for this project, if it has one.
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
      (m: {
        role: "user" | "model";
        content: string;
        context_saved: boolean;
        is_deliverable: boolean;
        grounding_sources?: GroundingSource[];
      }) => ({
        role: m.role,
        text: m.content,
        contextSaved: m.context_saved,
        isDeliverable: m.is_deliverable,
        groundingSources: m.grounding_sources ?? [],
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

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !agent || !projectId || sending) return;

    const history = messages;
    setMessages([...history, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          message: trimmed,
          projectId,
          conversationId,
          history,
          mode,
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
          groundingSources: data.groundingSources ?? [],
        },
      ]);

      if (SPREADSHEET_COMMAND.test(trimmed)) {
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

  return {
    messages,
    mode,
    setMode,
    conversationId,
    showHistory,
    setShowHistory,
    historyList,
    input,
    setInput,
    sending,
    loadingChat,
    error,
    downloading,
    driveLinks,
    driveConnected,
    scrollRef,
    loadConversation,
    openHistory,
    startNewChat,
    sendMessage,
    downloadDocument,
    downloadSpreadsheet,
    downloadPresentation,
    saveToDrive,
  };
}
