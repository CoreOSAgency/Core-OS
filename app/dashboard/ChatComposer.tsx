"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { agentSections, type Agent } from "@/lib/agents";
import type { ChatMode } from "@/lib/modelRouter";
import {
  ACCEPTED_FILE_TYPES,
  MAX_ATTACHMENT_BYTES,
  fileToBase64,
  webmToWav,
  type PendingAttachment,
} from "@/lib/attachments";

const MODE_LABELS: [ChatMode, string][] = [
  ["quick", "Quick"],
  ["standard", "Standard"],
  ["deep", "Deep Research"],
];

const ALL_AGENTS = agentSections.flatMap((s) => s.agents);

export default function ChatComposer({
  agentName,
  input,
  onInputChange,
  onSubmit,
  sending,
  mode,
  onModeChange,
  isGroup,
  participants,
  activeAgentId,
  onSelectAgent,
  onAddParticipant,
  onRemoveParticipant,
  onMention,
}: {
  agentName: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string, attachments?: PendingAttachment[]) => void;
  sending: boolean;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  isGroup: boolean;
  participants: Agent[];
  activeAgentId?: string;
  onSelectAgent: (a: Agent) => void;
  onAddParticipant: (a: Agent) => void;
  onRemoveParticipant: (a: Agent) => void;
  onMention: (a: Agent) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const mentionQuery = useMemo(() => {
    const m = input.match(/@(\w*)$/);
    return m ? m[1].toLowerCase() : null;
  }, [input]);
  const mentionMatches =
    mentionQuery === null
      ? []
      : ALL_AGENTS.filter((a) => a.name.toLowerCase().startsWith(mentionQuery)).slice(0, 6);

  function pickMention(a: Agent) {
    onInputChange(input.replace(/@\w*$/, isGroup ? `@${a.name} ` : ""));
    onMention(a);
  }

  function submit() {
    if ((!input.trim() && pending.length === 0) || sending) return;
    onSubmit(input, pending.length ? pending : undefined);
    setPending([]);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setAttachError(null);
    const next: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`${file.name} is over 15MB.`);
        continue;
      }
      const base64 = await fileToBase64(file);
      next.push({ fileName: file.name, mimeType: file.type || "application/octet-stream", base64 });
    }
    if (next.length) setPending((p) => [...p, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function startRec() {
    setAttachError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const webm = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          const wav = await webmToWav(webm);
          if (wav.size > MAX_ATTACHMENT_BYTES) {
            setAttachError("That recording is too long.");
            return;
          }
          const base64 = await fileToBase64(wav);
          setPending((p) => [
            ...p,
            { fileName: "voice-note.wav", mimeType: "audio/wav", base64, isVoice: true },
          ]);
        } catch {
          setAttachError("Couldn't process that recording.");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setAttachError("Microphone access was blocked.");
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const inThread = new Set(participants.map((p) => p.id));

  return (
    <div className="border-t border-white/10 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isGroup &&
          participants.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1 rounded-full py-1 pl-2 pr-1 text-[11px] font-medium ${
                p.id === activeAgentId ? "bg-core-teal text-[#05221f]" : "bg-white/5 text-neutral-300"
              }`}
            >
              <button type="button" onClick={() => onSelectAgent(p)} className="flex items-center gap-1">
                <span>{p.emoji}</span>
                {p.name}
              </button>
              {participants.length > 1 && (
                <button
                  type="button"
                  title={`Remove ${p.name}`}
                  onClick={() => onRemoveParticipant(p)}
                  className="rounded-full px-1 opacity-70 hover:text-core-scarlet hover:opacity-100"
                >
                  ×
                </button>
              )}
            </span>
          ))}

        {isGroup && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              title="Add an agent to this chat"
              className="flex h-6 items-center rounded-full border border-white/10 px-2 text-[11px] text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            >
              + Agent
            </button>
            {pickerOpen && (
              <div className="absolute bottom-8 left-0 z-30 max-h-72 w-56 overflow-y-auto rounded-lg border border-white/10 bg-core-card p-2 shadow-xl">
                {agentSections.map((section) => (
                  <div key={section.id} className="mb-2 last:mb-0">
                    <p className="px-1 pb-1 text-[10px] font-semibold tracking-widest text-core-amber">
                      {section.title}
                    </p>
                    {section.agents.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        disabled={inThread.has(a.id)}
                        onClick={() => {
                          onAddParticipant(a);
                          setPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-40"
                      >
                        <span>{a.emoji}</span>
                        <span className="truncate">{a.name}</span>
                        {inThread.has(a.id) && (
                          <span className="ml-auto text-[10px] text-neutral-500">in chat</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <span className="flex-1" />

        <div className="flex w-fit gap-0.5 rounded-lg border border-white/10 p-0.5">
          {MODE_LABELS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                mode === m ? "bg-core-purple text-[#111214]" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending attachments */}
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-core-main px-2 py-1.5 text-xs text-neutral-300"
            >
              {a.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${a.mimeType};base64,${a.base64}`}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              ) : a.isVoice ? (
                <audio controls src={`data:${a.mimeType};base64,${a.base64}`} className="h-7 w-40" />
              ) : (
                <span className="max-w-[10rem] truncate">📄 {a.fileName}</span>
              )}
              <button
                type="button"
                onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                className="text-neutral-500 hover:text-core-scarlet"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {attachError && <p className="mb-2 text-[11px] text-core-scarlet">{attachError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative flex items-end gap-2"
      >
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-12 left-10 z-30 w-56 overflow-hidden rounded-lg border border-white/10 bg-core-card shadow-xl">
            {mentionMatches.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => pickMention(a)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-200 hover:bg-white/5"
              >
                <span>{a.emoji}</span>
                {a.name}
                {!isGroup && <span className="ml-auto text-[10px] text-neutral-500">new group</span>}
              </button>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || recording}
          title="Attach a file"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-neutral-400 hover:bg-white/5 hover:text-neutral-100 disabled:opacity-40"
        >
          +
        </button>

        {recording ? (
          <div className="flex h-9 w-full items-center gap-3 rounded-lg border border-core-scarlet/40 bg-core-main px-3 text-sm text-neutral-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-core-scarlet" />
            Recording {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:
            {String(recSeconds % 60).padStart(2, "0")}
            <span className="flex-1" />
            <button type="button" onClick={stopRec} className="text-xs text-core-purple hover:underline">
              Stop
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={sending}
            placeholder={
              isGroup
                ? `Message ${agentName}… (@ to add an agent, Shift+Enter for newline)`
                : `Message ${agentName}… (@ for a group chat, Shift+Enter for newline)`
            }
            className="w-full resize-none rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-core-purple disabled:opacity-60"
          />
        )}

        <button
          type="button"
          onClick={recording ? stopRec : startRec}
          disabled={sending}
          title={recording ? "Stop recording" : "Record a voice note"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-white/5 disabled:opacity-40 ${
            recording ? "text-core-scarlet" : "text-neutral-400 hover:text-neutral-100"
          }`}
        >
          🎤
        </button>
        <button
          type="submit"
          disabled={sending || recording || (!input.trim() && pending.length === 0)}
          className="h-9 shrink-0 rounded-lg bg-core-purple px-4 text-sm font-medium text-[#111214] transition hover:bg-core-purple/80 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          Send
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-neutral-600">
        {isGroup ? "Group chat" : `${agentName} has your whole agency context loaded.`}
      </p>
    </div>
  );
}
