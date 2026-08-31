"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_PROMPTS, type Agent } from "@/lib/agents";
import type { Conversation } from "@/lib/conversations";
import { useActiveProject } from "@/lib/useActiveProject";
import { useAgentChat, type ConversationSummary } from "@/lib/useAgentChat";
import { LAST_AGENT_KEY } from "@/lib/localStorageKeys";
import IconSidebar, { type IconSection } from "../../IconSidebar";
import ChatComposer from "../../ChatComposer";
import ChatMessage from "../../ChatMessage";
import AgentHistoryNav from "./AgentHistoryNav";
import AgentRosterNav from "./AgentRosterNav";

export default function AgentChatShell({
  agent,
  userEmail,
  avatarUrl,
}: {
  agent: Agent;
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const { project } = useActiveProject();
  const projectId = project?.id ?? null;
  const [driveConnected, setDriveConnected] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[] | null>(null);
  const [groups, setGroups] = useState<Conversation[]>([]);

  const chat = useAgentChat({ agent, projectId, projectName: project?.name ?? null, driveConnected });

  const refreshGroups = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/groups`)
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => setGroups(d.conversations ?? []));
  }, [projectId]);

  useEffect(refreshGroups, [refreshGroups]);

  async function startGroupWith(next: Agent) {
    const id = await chat.forkToGroup(next);
    if (id) {
      refreshGroups();
      router.push(`/dashboard/groups/${id}`);
    }
  }

  async function newGroup() {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentIds: [agent.id],
        seedFromConversationId: chat.conversationId ?? undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data.conversation?.id) {
      refreshGroups();
      router.push(`/dashboard/groups/${data.conversation.id}`);
    }
  }

  useEffect(() => {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data: { googleDrive?: boolean }) => setDriveConnected(!!data.googleDrive));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_AGENT_KEY, agent.id);
    } catch {
      // per-browser convenience only
    }
  }, [agent.id]);

  function refreshHistory() {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/conversations?agentId=${agent.id}`)
      .then((res) => res.json())
      .then((data: { conversations?: ConversationSummary[] }) => setHistory(data.conversations ?? []));
  }

  useEffect(() => {
    setHistory(null);
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, agent.id]);

  // Refresh the sidebar list once a send completes (new/renamed conversation).
  useEffect(() => {
    if (!chat.sending) refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.sending]);

  function onNavigate(section: IconSection) {
    if (section === "agency") return router.push("/dashboard?view=agency");
    if (section === "workflows") return router.push("/dashboard/workflows");
    if (section === "settings") return router.push("/dashboard/settings/organization");
    router.push(section === "dashboard" ? "/dashboard" : `/dashboard?view=${section}`);
  }

  // Switching agents from the roster panel navigates to that agent's own
  // page — never back to the dashboard, and never a different panel that
  // hides the roster.
  function switchAgent(next: Agent) {
    if (next.id === agent.id) return;
    router.push(`/dashboard/agency/${next.id}`);
  }

  const prompts = AGENT_PROMPTS[agent.id] ?? [];

  return (
    <div className="flex h-screen bg-core-main">
      <IconSidebar active="agency" onNavigate={onNavigate} userEmail={userEmail} avatarUrl={avatarUrl} />
      <AgentRosterNav
        selectedAgentId={agent.id}
        onSelectAgent={switchAgent}
        groups={groups}
        onSelectGroup={(id) => router.push(`/dashboard/groups/${id}`)}
        onNewGroup={newGroup}
      />
      <AgentHistoryNav
        agent={agent}
        history={history}
        activeConversationId={chat.conversationId}
        onNewChat={chat.startNewChat}
        onSelectConversation={chat.loadConversation}
      />

      <main className="flex min-h-0 flex-1 flex-col bg-core-main">
        {!projectId ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
            Create a project from the dashboard first.
          </div>
        ) : (
          <>
            <div ref={chat.scrollRef} className="flex-1 space-y-4 overflow-y-auto px-8 py-8">
              {!chat.loadingChat && chat.messages.length === 0 ? (
                <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
                  <span className="text-5xl">{agent.emoji}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-100">{agent.name}</h2>
                    <p className="text-sm text-neutral-500">{agent.description}</p>
                  </div>
                  <p className="text-base font-medium text-core-purple">
                    Hey{project?.name ? ` ${project.name}` : ""}, what can we help you with today?
                  </p>
                  <p className="text-sm text-neutral-500">
                    Ask a question or pick a starting point below.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {prompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => chat.sendMessage(p)}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs text-neutral-300 hover:border-core-purple/50 hover:text-core-purple"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-4">
                  {chat.messages.map((turn, i) => (
                    <ChatMessage
                      key={i}
                      turn={turn}
                      index={i}
                      agent={agent}
                      showAvatar
                      multiAgent={false}
                      onAcceptHandoff={startGroupWith}
                      driveConnected={driveConnected}
                      downloading={chat.downloading}
                      driveLinks={chat.driveLinks}
                      onDownloadDocument={chat.downloadDocument}
                      onDownloadSpreadsheet={chat.downloadSpreadsheet}
                      onDownloadPresentation={chat.downloadPresentation}
                      onSaveToDrive={chat.saveToDrive}
                    />
                  ))}
                  {chat.sending && (
                    <div className="rounded-lg bg-core-card px-3 py-2 text-sm text-neutral-400">
                      {chat.mode === "deep"
                        ? "Researching…"
                        : `${chat.activeAgent?.name ?? agent.name} is typing…`}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-3xl">
              {chat.error && (
                <p className="mb-2 px-2 text-sm text-core-scarlet">{chat.error}</p>
              )}
              <ChatComposer
                agentName={agent.name}
                input={chat.input}
                onInputChange={chat.setInput}
                onSubmit={chat.sendMessage}
                sending={chat.sending}
                mode={chat.mode}
                onModeChange={chat.setMode}
                isGroup={false}
                participants={chat.participants}
                activeAgentId={chat.activeAgent?.id}
                onSelectAgent={chat.setActiveAgent}
                onAddParticipant={chat.addParticipant}
                onRemoveParticipant={chat.removeParticipant}
                onMention={startGroupWith}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
