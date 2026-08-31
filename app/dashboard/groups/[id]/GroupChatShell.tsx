"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/lib/agents";
import type { Conversation } from "@/lib/conversations";
import { useActiveProject } from "@/lib/useActiveProject";
import { useAgentChat } from "@/lib/useAgentChat";
import IconSidebar, { type IconSection } from "../../IconSidebar";
import AgentRosterNav from "../../agency/[agentId]/AgentRosterNav";
import ChatComposer from "../../ChatComposer";
import ChatMessage from "../../ChatMessage";

export default function GroupChatShell({
  groupId,
  userEmail,
  avatarUrl,
}: {
  groupId: string;
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const { project } = useActiveProject();
  const projectId = project?.id ?? null;
  const [driveConnected, setDriveConnected] = useState(false);
  const [groups, setGroups] = useState<Conversation[]>([]);

  const chat = useAgentChat({
    agent: null,
    projectId,
    projectName: project?.name ?? null,
    driveConnected,
    groupConversationId: groupId,
  });

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((d: { googleDrive?: boolean }) => setDriveConnected(!!d.googleDrive));
  }, []);

  const refreshGroups = useCallback(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/groups`)
      .then((r) => r.json())
      .then((d: { conversations?: Conversation[] }) => setGroups(d.conversations ?? []));
  }, [projectId]);
  useEffect(refreshGroups, [refreshGroups, chat.participants.length]);

  function onNavigate(section: IconSection) {
    if (section === "agency") return router.push("/dashboard?view=agency");
    if (section === "workflows") return router.push("/dashboard/workflows");
    if (section === "settings") return router.push("/dashboard/settings/organization");
    router.push(section === "dashboard" ? "/dashboard" : `/dashboard?view=${section}`);
  }

  const title = groups.find((g) => g.id === groupId)?.title ?? "Group chat";

  return (
    <div className="flex h-screen bg-core-main">
      <IconSidebar active="agency" onNavigate={onNavigate} userEmail={userEmail} avatarUrl={avatarUrl} />
      <AgentRosterNav
        selectedAgentId={null}
        onSelectAgent={(a: Agent) => router.push(`/dashboard/agency/${a.id}`)}
        groups={groups}
        activeGroupId={groupId}
        onSelectGroup={(id) => router.push(`/dashboard/groups/${id}`)}
      />

      <main className="flex min-h-0 flex-1 flex-col bg-core-main">
        {!projectId ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
            Create a project from the dashboard first.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-white/5 px-8 py-4">
              <span className="flex -space-x-1.5">
                {chat.participants.slice(0, 5).map((p) => (
                  <span
                    key={p.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-core-main bg-core-card text-sm"
                  >
                    {p.emoji}
                  </span>
                ))}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
                <p className="text-xs text-neutral-500">
                  {chat.participants.map((p) => p.name).join(", ")}
                </p>
              </div>
            </header>

            <div ref={chat.scrollRef} className="flex-1 space-y-4 overflow-y-auto px-8 py-8">
              <div className="mx-auto max-w-3xl space-y-4">
                {(chat.activeAgent ?? chat.participants[0]) &&
                  chat.messages.map((turn, i) => (
                  <ChatMessage
                    key={i}
                    turn={turn}
                    index={i}
                    agent={(chat.activeAgent ?? chat.participants[0])!}
                    showAvatar
                    multiAgent
                    onAcceptHandoff={chat.addParticipant}
                    driveConnected={driveConnected}
                    downloading={chat.downloading}
                    driveLinks={chat.driveLinks}
                    onDownloadDocument={chat.downloadDocument}
                    onDownloadSpreadsheet={chat.downloadSpreadsheet}
                    deckTokens={chat.deckTokens}
                    onOpenDeck={chat.openDeck}
                    onDownloadDeckPdf={chat.downloadDeckPdf}
                    onSaveToDrive={chat.saveToDrive}
                  />
                ))}
                {chat.messages.length === 0 && !chat.loadingChat && (
                  <p className="text-center text-sm text-neutral-500">
                    Message an agent below. Use the chips to pick who answers.
                  </p>
                )}
                {chat.sending && (
                  <div className="rounded-lg bg-core-card px-3 py-2 text-sm text-neutral-400">
                    {chat.mode === "deep"
                      ? "Researching…"
                      : `${chat.activeAgent?.name ?? "Agent"} is typing…`}
                  </div>
                )}
                {chat.error && <p className="text-sm text-core-scarlet">{chat.error}</p>}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl">
              <ChatComposer
                agentName={chat.activeAgent?.name ?? "the group"}
                input={chat.input}
                onInputChange={chat.setInput}
                onSubmit={chat.sendMessage}
                sending={chat.sending}
                mode={chat.mode}
                onModeChange={chat.setMode}
                isGroup
                participants={chat.participants}
                activeAgentId={chat.activeAgent?.id}
                onSelectAgent={chat.setActiveAgent}
                onAddParticipant={chat.addParticipant}
                onRemoveParticipant={chat.removeParticipant}
                onMention={(a) => {
                  if (chat.participants.some((p) => p.id === a.id)) chat.setActiveAgent(a);
                  else chat.addParticipant(a);
                }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
