"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findAgent, type Agent } from "@/lib/agents";
import { extractTableData, hasSlideStructure } from "@/lib/markdownToBlocks";
import { createClient } from "@/lib/supabase/client";
import type { ChatAttachment, ChatTurn } from "@/lib/useAgentChat";

// Resolves its own URL: a data: URL for a just-sent attachment, or a signed
// Storage URL for one loaded from history.
function AttachmentView({ att }: { att: ChatAttachment }) {
  const [url, setUrl] = useState<string | null>(att.dataUrl ?? null);
  useEffect(() => {
    if (att.dataUrl || !att.storage_path) return;
    createClient()
      .storage.from("chat-attachments")
      .createSignedUrl(att.storage_path, 3600)
      .then(({ data }) => data?.signedUrl && setUrl(data.signedUrl));
  }, [att.dataUrl, att.storage_path]);

  if (!url) return <span className="text-xs text-neutral-500">📎 {att.file_name}</span>;
  if (att.mime_type.startsWith("image/"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={att.file_name} className="max-h-48 rounded-lg border border-white/10" />;
  if (att.mime_type.startsWith("audio/"))
    return <audio controls src={url} className="h-8 w-56" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs text-core-purple hover:underline">
      📄 {att.file_name}
    </a>
  );
}

// Tight, dark-theme-matched overrides — markdown's default block spacing is
// too loose for a chat bubble at text-sm.
const markdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<"p">) => <p className="mb-2 last:mb-0" {...props} />,
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
    <a className="underline hover:text-core-green" target="_blank" rel="noreferrer" {...props} />
  ),
  table: (props: React.ComponentPropsWithoutRef<"table">) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  th: (props: React.ComponentPropsWithoutRef<"th">) => (
    <th className="border border-neutral-600 bg-neutral-900 px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: (props: React.ComponentPropsWithoutRef<"td">) => (
    <td className="border border-neutral-700 px-2 py-1" {...props} />
  ),
};

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
        className="rounded border border-core-green px-2 py-1 text-xs text-core-green hover:bg-core-purple/10"
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

export default function ChatMessage({
  turn,
  index,
  agent,
  showAvatar,
  multiAgent,
  onAcceptHandoff,
  driveConnected,
  downloading,
  driveLinks,
  onDownloadDocument,
  onDownloadSpreadsheet,
  onDownloadPresentation,
  onSaveToDrive,
}: {
  turn: ChatTurn;
  index: number;
  agent: Agent;
  showAvatar?: boolean;
  multiAgent?: boolean;
  onAcceptHandoff?: (a: Agent) => void;
  driveConnected: boolean;
  downloading: string | null;
  driveLinks: Record<string, string>;
  onDownloadDocument: (index: number, text: string, type: "pdf" | "docx") => void;
  onDownloadSpreadsheet: (index: number, data: Record<string, string>[]) => void;
  onDownloadPresentation: (index: number, text: string, qa?: boolean) => void;
  onSaveToDrive: (index: number, type: "pdf" | "docx" | "xlsx" | "pptx", text: string) => void;
}) {
  const isUser = turn.role === "user";
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  // In a multi-agent thread each model bubble shows who actually spoke.
  const speaker =
    (turn.agentId ? findAgent(turn.agentId) : null) ?? agent;
  const suggested =
    turn.role === "model" && turn.suggestedAgentId
      ? findAgent(turn.suggestedAgentId)
      : null;

  return (
    <div className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && showAvatar && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-core-card text-sm">
          {speaker.emoji}
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-core-teal text-[#05221f]" : "bg-core-card text-neutral-100"
        }`}
      >
        {!isUser && multiAgent && (
          <p className="mb-1 text-xs font-semibold text-core-amber">
            {speaker.emoji} {speaker.name}
          </p>
        )}
        {turn.attachments && turn.attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {turn.attachments.map((a, i) => (
              <AttachmentView key={i} att={a} />
            ))}
          </div>
        )}
        {turn.role === "model" ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {turn.text}
          </ReactMarkdown>
        ) : (
          turn.text
        )}
        {suggested && !handoffDismissed && (
          <div className="mt-2 flex items-center gap-2 border-t border-neutral-700/60 pt-2">
            <button
              onClick={() => onAcceptHandoff?.(suggested)}
              className="rounded-full bg-core-teal px-3 py-1 text-xs font-medium text-[#05221f] hover:bg-core-teal/90"
            >
              Bring in {suggested.name}
            </button>
            <button
              onClick={() => setHandoffDismissed(true)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Dismiss
            </button>
          </div>
        )}
        {turn.contextSaved && <p className="mt-1.5 text-xs text-core-green/80">✓ Project memory saved</p>}
        {turn.role === "model" && turn.groundingSources && turn.groundingSources.length > 0 && (
          <details className="mt-2 border-t border-neutral-700/60 pt-2">
            <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
              Sources ({turn.groundingSources.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {turn.groundingSources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-core-green hover:underline"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
        {turn.role === "model" && turn.isDeliverable && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-neutral-700/60 pt-2">
            <button
              onClick={() => onDownloadDocument(index, turn.text, "pdf")}
              disabled={downloading === `${index}-pdf`}
              className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
            >
              {downloading === `${index}-pdf` ? "Generating…" : "⬇ Download as PDF"}
            </button>
            {driveConnected && (
              <DriveButton
                downloading={downloading === `${index}-pdf-drive`}
                link={driveLinks[`${index}-pdf-drive`]}
                onClick={() => onSaveToDrive(index, "pdf", turn.text)}
              />
            )}
            <button
              onClick={() => onDownloadDocument(index, turn.text, "docx")}
              disabled={downloading === `${index}-docx`}
              className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
            >
              {downloading === `${index}-docx` ? "Generating…" : "⬇ Download as Word Doc"}
            </button>
            {driveConnected && (
              <DriveButton
                downloading={downloading === `${index}-docx-drive`}
                link={driveLinks[`${index}-docx-drive`]}
                onClick={() => onSaveToDrive(index, "docx", turn.text)}
              />
            )}
            {(() => {
              const tableData = extractTableData(turn.text);
              if (!tableData) return null;
              return (
                <>
                  <button
                    onClick={() => onDownloadSpreadsheet(index, tableData)}
                    disabled={downloading === `${index}-xlsx`}
                    className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                  >
                    {downloading === `${index}-xlsx` ? "Generating…" : "⬇ Download as Spreadsheet"}
                  </button>
                  {driveConnected && (
                    <DriveButton
                      downloading={downloading === `${index}-xlsx-drive`}
                      link={driveLinks[`${index}-xlsx-drive`]}
                      onClick={() => onSaveToDrive(index, "xlsx", turn.text)}
                    />
                  )}
                </>
              );
            })()}
            {hasSlideStructure(turn.text) && (
              <>
                <button
                  onClick={() => onDownloadPresentation(index, turn.text)}
                  disabled={downloading === `${index}-pptx`}
                  className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {downloading === `${index}-pptx` ? "Generating…" : "⬇ Download as Presentation"}
                </button>
                <button
                  onClick={() => onDownloadPresentation(index, turn.text, true)}
                  disabled={downloading === `${index}-pptx-qa`}
                  title="Renders each slide and runs a visual check for text overflow and overlap before downloading. Slower: adds a render pass and an AI vision call."
                  className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
                >
                  {downloading === `${index}-pptx-qa` ? "Checking…" : "⬇ QA check + download"}
                </button>
                {driveConnected && (
                  <DriveButton
                    downloading={downloading === `${index}-pptx-drive`}
                    link={driveLinks[`${index}-pptx-drive`]}
                    onClick={() => onSaveToDrive(index, "pptx", turn.text)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
