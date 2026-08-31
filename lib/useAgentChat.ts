"use client";

import { useEffect, useRef, useState } from "react";
import { findAgent, type Agent } from "@/lib/agents";
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
  agentId?: string;
  agentName?: string;
  suggestedAgentId?: string | null;
};

const CHAT_MODES: ChatMode[] = ["quick", "standard", "deep"];

export type ConversationSummary = {
  id: string;
  title: string | null;
  updated_at: string;
  participant_agent_ids?: string[];
};

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
  groupConversationId,
}: {
  agent: Agent | null;
  projectId: string | null;
  projectName: string | null;
  driveConnected: boolean;
  // When set, this hook drives a group chat: that one conversation, its
  // participants, no "resume the agent's latest 1:1" behaviour.
  groupConversationId?: string | null;
}) {
  const isGroup = !!groupConversationId;
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [mode, setModeState] = useState<ChatMode>("standard");
  // Multi-agent: `participants` is everyone in the thread; `activeAgent` is
  // who the next message routes to (starts as the panel's agent).
  const [participants, setParticipants] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(agent);
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
    setActiveAgent(agent);
    setParticipants(agent ? [agent] : []);

    if (groupConversationId) {
      setLoadingChat(true);
      loadConversation(groupConversationId).finally(() => setLoadingChat(false));
      return;
    }

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
  }, [agent?.id, projectId, groupConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending, showHistory]);

  async function loadConversation(id: string) {
    const [msgRes, partRes] = await Promise.all([
      fetch(`/api/conversations/${id}/messages`).then((r) => r.json()),
      fetch(`/api/conversations/${id}/participants`).then((r) => r.json()),
    ]);
    const loaded: ChatTurn[] = (msgRes.messages ?? []).map(
      (m: {
        role: "user" | "model";
        content: string;
        context_saved: boolean;
        is_deliverable: boolean;
        grounding_sources?: GroundingSource[];
        agent_id?: string | null;
      }) => ({
        role: m.role,
        text: m.content,
        contextSaved: m.context_saved,
        isDeliverable: m.is_deliverable,
        groundingSources: m.grounding_sources ?? [],
        agentId: m.agent_id ?? undefined,
        agentName: m.agent_id ? findAgent(m.agent_id)?.name : undefined,
      })
    );
    const parts: Agent[] = ((partRes.participants ?? []) as string[])
      .map((pid) => findAgent(pid))
      .filter((a): a is Agent => !!a);

    setMessages(loaded);
    setParticipants(parts.length ? parts : agent ? [agent] : []);
    // Keep the current active agent if it's in the thread, else fall back to
    // the panel's agent or the first participant.
    setActiveAgent((prev) => {
      if (prev && parts.some((p) => p.id === prev.id)) return prev;
      return agent ?? parts[0] ?? null;
    });
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
    if (isGroup) return; // a group chat is its own thread
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    setActiveAgent(agent);
    setParticipants(agent ? [agent] : []);
  }

  // GROUP ONLY: add an agent to this group and route the next message to
  // them. Nothing is sent until the user writes and submits it.
  async function addParticipant(next: Agent) {
    setParticipants((prev) =>
      prev.some((p) => p.id === next.id) ? prev : [...prev, next]
    );
    setActiveAgent(next);
    if (conversationId) {
      await fetch(`/api/conversations/${conversationId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: next.id }),
      }).catch(() => {});
    }
  }

  // GROUP ONLY: remove an agent. The server refuses to leave a group empty.
  async function removeParticipant(target: Agent) {
    if (!conversationId) return;
    const res = await fetch(`/api/conversations/${conversationId}/participants`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: target.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Couldn't remove that agent");
      return;
    }
    const kept: Agent[] = (data.participants as string[])
      .map((id) => findAgent(id))
      .filter((a): a is Agent => !!a);
    setParticipants(kept);
    setActiveAgent((prev) =>
      prev && kept.some((k) => k.id === prev.id) ? prev : kept[0] ?? null
    );
  }

  // 1:1 ONLY: fork the current thread into a new group chat that also
  // includes `withAgent`, seeded with this conversation's messages. Returns
  // the new group's id so the caller can navigate to it. Sends nothing.
  async function forkToGroup(withAgent: Agent): Promise<string | null> {
    if (!projectId || !agent) return null;
    const res = await fetch(`/api/projects/${projectId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentIds: [agent.id, withAgent.id],
        seedFromConversationId: conversationId ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.conversation?.id) {
      setError(data?.error ?? "Couldn't start that group chat");
      return null;
    }
    return data.conversation.id as string;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    const routeTo = activeAgent ?? agent;
    if (!trimmed || !routeTo || !projectId || sending) return;

    const history = messages;
    setMessages([...history, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    setError(null);
    setParticipants((prev) =>
      prev.some((p) => p.id === routeTo.id) ? prev : [...prev, routeTo]
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: routeTo.id,
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
          agentId: routeTo.id,
          agentName: routeTo.name,
          suggestedAgentId: data.suggestedAgentId ?? null,
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
          projectId,
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
          projectId,
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
    isGroup,
    participants,
    activeAgent,
    setActiveAgent,
    addParticipant,
    removeParticipant,
    forkToGroup,
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
