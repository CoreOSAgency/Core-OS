"use client";

// A file/voice note chosen in the composer but not yet sent. base64 is only
// used for the optimistic in-chat preview; the real bytes go up to Storage.
export type PendingAttachment = {
  fileName: string;
  mimeType: string;
  base64: string; // no data: prefix - for the optimistic in-chat preview only
  blob: Blob; // the real bytes, uploaded to Storage on send
  isVoice?: boolean;
};

// What gets persisted on a message row and returned by getMessages.
export type StoredAttachment = {
  storage_path: string;
  mime_type: string;
  file_name: string;
};

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = "image/*,application/pdf,.doc,.docx";

export function base64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// MediaRecorder gives webm/opus in Chrome, which Gemini's inline audio input
// rejects. Decode it and re-encode as 16-bit PCM WAV (mono, 16kHz - plenty
// for speech, keeps the payload small), which Gemini accepts everywhere.
export async function webmToWav(blob: Blob): Promise<Blob> {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16000;
    const length = Math.ceil((decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, length, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), targetRate);
  } finally {
    ctx.close();
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
