// Fetches a client's logo for embedding in a generated deck/doc. Returns
// null on any failure - a bad logo URL must never break file generation.

export type ExportImage = {
  bytes: Uint8Array;
  base64: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

function pngSize(b: Uint8Array): { width: number; height: number } | null {
  // IHDR width/height are big-endian uint32 at offsets 16 and 20.
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry dimensions.
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

export async function fetchImageForExport(url: string): Promise<ExportImage | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5_000_000) return null;

    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    if (!isPng && !isJpeg) return null; // SVG/webp/gif not supported by the generators

    const dims = (isPng ? pngSize(buf) : jpegSize(buf)) ?? { width: 200, height: 60 };
    return {
      bytes: buf,
      base64: Buffer.from(buf).toString("base64"),
      mime: isPng ? "image/png" : "image/jpeg",
      width: dims.width,
      height: dims.height,
    };
  } catch {
    return null;
  }
}

// "#7c3aed" | "7c3aed" | "#7c3aed, #111" -> "7C3AED", or null if unparseable.
export function normalizeHex(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/#?([0-9a-fA-F]{6})/);
  return m ? m[1].toUpperCase() : null;
}
