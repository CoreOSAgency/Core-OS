"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CORE_AGENT, type Agent } from "@/lib/agents";
import { relativeTime, useAgentChat } from "@/lib/useAgentChat";
import ChatComposer from "./ChatComposer";
import ChatMessage from "./ChatMessage";
import ThinkingIndicator from "./ThinkingIndicator";
import ParticipantStack from "./ParticipantStack";

const PROMPTS = [
  "Help me add my first client",
  "Import my existing client list",
  "Help me get new clients",
];

// Core — the general assistant. Fixed, always visible on the Dashboard
// section (not a slide-over like agent chats). Collapses to a small tab
// rather than disappearing entirely, since it has no other entry point.
export default function CorePanel({
  projectId,
  projectName,
  driveConnected,
}: {
  projectId: string | null;
  projectName: string | null;
  driveConnected: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const chat = useAgentChat({ agent: CORE_AGENT, projectId, projectName, driveConnected });

  async function startGroupWith(next: Agent) {
    const id = await chat.forkToGroup(next);
    if (id) router.push(`/dashboard/groups/${id}`);
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Open Core"
        className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-1.5 rounded-l-lg border border-r-0 border-white/10 bg-core-nav px-2 py-3 text-neutral-300 hover:bg-core-card"
      >
        <span className="text-lg">{CORE_AGENT.emoji}</span>
      </button>
    );
  }

  return (
    <aside className="flex h-full w-[380px] max-w-full shrink-0 flex-col border-l border-white/10 bg-core-nav">
      <div className="sunbird-band h-1 w-full shrink-0" />
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{CORE_AGENT.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-neutral-100">Core</h2>
              <span className="rounded-full bg-core-purple/15 px-2 py-0.5 text-[10px] font-medium text-core-purple">
                Agency
              </span>
            </div>
            <p className="text-xs text-neutral-400">General Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => (chat.showHistory ? chat.setShowHistory(false) : chat.openHistory())}
            aria-label="Chat history"
            title="Chat history"
            className={`rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100 ${
              chat.showHistory ? "bg-white/5 text-neutral-100" : ""
            }`}
          >
            🕘
          </button>
          <button
            onClick={chat.startNewChat}
            aria-label="New chat"
            title="New chat"
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
          >
            ✎
          </button>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse"
            title="Collapse"
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>
      </div>

      {chat.showHistory ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <button
            onClick={chat.startNewChat}
            className="mb-3 w-full rounded-lg border border-core-purple px-3 py-2 text-left text-sm font-medium text-core-purple hover:bg-core-purple/10"
          >
            + New chat
          </button>
          {chat.historyList === null && <p className="text-sm text-neutral-500">Loading…</p>}
          {chat.historyList !== null && chat.historyList.length === 0 && (
            <p className="text-sm text-neutral-500">No past chats with Core yet.</p>
          )}
          <ul className="space-y-1">
            {chat.historyList?.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => chat.loadConversation(c.id)}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    c.id === chat.conversationId ? "bg-white/5 text-neutral-100" : "text-neutral-300"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="block flex-1 truncate">{c.title || "New chat"}</span>
                    <ParticipantStack agentIds={c.participant_agent_ids} />
                  </span>
                  <span className="text-xs text-neutral-500">{relativeTime(c.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div ref={chat.scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!chat.loadingChat && chat.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="text-4xl">{CORE_AGENT.emoji}</span>
              <div>
                <h3 className="font-semibold text-neutral-100">Core</h3>
                <p className="text-xs text-neutral-500">General Assistant</p>
              </div>
              <p className="text-sm font-medium text-core-purple">
                Hey{projectName ? ` ${projectName}` : ""}, need help managing your agency?
              </p>
              <div className="flex flex-col gap-2">
                {PROMPTS.map((p) => (
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
            chat.messages.map((turn, i) => (
              <ChatMessage
                key={i}
                turn={turn}
                index={i}
                agent={CORE_AGENT}
                showAvatar
                multiAgent={false}
                onAcceptHandoff={startGroupWith}
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
            ))
          )}

          {chat.sending && (
            <ThinkingIndicator
              agentName={chat.activeAgent?.name ?? "Core"}
              mode={chat.mode}
              lastMessage={chat.messages[chat.messages.length - 1]?.text}
                    activity={chat.streamActivity}
            />
          )}
          {chat.error && <p className="text-sm text-core-scarlet">{chat.error}</p>}
        </div>
      )}

      {!chat.showHistory && (
        <ChatComposer
          agentName="Core"
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
      )}
    </aside>
  );
}
