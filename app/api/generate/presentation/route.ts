import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/projects";
import { normalizeHex } from "@/lib/imageForExport";
import { buildDeckModel, type SlideImage } from "@/lib/deckModel";
import { createDeck } from "@/lib/decks";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMAGE_MODEL = "gemini-3.1-flash-lite-image";

// One illustrative image for a slide. Fails open: returns null on any error
// (rate limit, model error) so the deck still builds without it.
async function generateSlideImage(
  prompt: string,
  accent: string | undefined,
  key: string
): Promise<{ base64: string; mime: string } | null> {
  const styled =
    `${prompt}. Polished modern editorial illustration, cinematic depth and lighting` +
    (accent ? `, #${accent} as the dominant accent colour` : "") +
    `, set against a dark background that fades to near-black at the edges. Absolutely no text, words, letters, numbers, charts, graphs, or logos anywhere in the image.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: styled }] }],
          generationConfig: { responseModalities: ["Text", "Image"] },
        }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const parts: Array<{ inline_data?: { data: string; mime_type: string }; inlineData?: { data: string; mimeType: string } }> =
      json?.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const inline = p.inline_data ?? p.inlineData;
      if (inline?.data) {
        return {
          base64: inline.data,
          mime: (inline as { mime_type?: string }).mime_type ?? (inline as { mimeType?: string }).mimeType ?? "image/png",
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function generateAndStore(
  supabase: SupabaseClient,
  { slideIndex, prompt }: { slideIndex: number; prompt: string },
  accent: string | undefined,
  key: string
): Promise<SlideImage | null> {
  const img = await generateSlideImage(prompt, accent, key);
  if (!img) return null;
  const ext = img.mime === "image/jpeg" ? "jpg" : "png";
  const path = `${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("deck-assets")
    .upload(path, Buffer.from(img.base64, "base64"), { contentType: img.mime, upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from("deck-assets").getPublicUrl(path);
  return { slideIndex, url: data.publicUrl };
}

// Builds a deck, persists it, and returns a shareable link. The deck renders
// as a live HTML page (app/decks/[shareToken]); there is no .pptx anymore.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title: unknown = body?.title;
  const slides: unknown = body?.slides;
  const projectId: unknown = body?.projectId;
  const imagePrompts: { slideIndex: number; prompt: string }[] = Array.isArray(
    body?.slideImagePrompts
  )
    ? body.slideImagePrompts.filter(
        (p: unknown) =>
          !!p &&
          typeof (p as { slideIndex: number }).slideIndex === "number" &&
          typeof (p as { prompt: string }).prompt === "string"
      )
    : [];

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { error: "slides must be a non-empty array" },
      { status: 400 }
    );
  }
  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const brand = await getBrandKit(supabase, projectId);

  // Generate the slide images in parallel, upload each to the deck-assets
  // bucket, and reference them by URL. Any that fail just leave their slide
  // text-only.
  const key = process.env.GEMINI_API_KEY;
  const accentHex = normalizeHex(brand.accentColor) ?? undefined;
  const slideImages: SlideImage[] = key
    ? (
        await Promise.all(
          imagePrompts
            .filter((p) => p.slideIndex >= 1 && p.slideIndex <= slides.length)
            .slice(0, 12)
            .map((p) => generateAndStore(supabase, p, accentHex, key))
        )
      ).filter((x): x is SlideImage => x !== null)
    : [];

  const model = await buildDeckModel({ title, slides, slideImages, ...brand });

  try {
    const { shareToken } = await createDeck(supabase, projectId, title, model);
    return NextResponse.json({ shareToken, url: `/decks/${shareToken}` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save the deck" },
      { status: 500 }
    );
  }
}
