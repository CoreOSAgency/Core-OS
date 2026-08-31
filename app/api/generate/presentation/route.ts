import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/projects";
import { normalizeHex } from "@/lib/imageForExport";
import { renderPptxFromModel } from "@/lib/presentationGenerator";
import { buildDeckModel, applyQaFixes, type SlideImage, type QaIssue } from "@/lib/deckModel";
import { screenshotContentSlides, reviewSlideShots, qaNotesSentence } from "@/lib/deckQa";
import { slugifyFilename } from "@/lib/documentGenerators";

// Headless Chrome (QA path) needs the Node runtime and headroom for a render
// pass plus one retry.
export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_MODEL = "gemini-3.1-flash-lite-image";

// One illustrative image for a slide. Fails open: returns null on any error
// (rate limit, billing not enabled, model error) so the deck still builds.
async function generateSlideImage(
  prompt: string,
  accent: string | undefined,
  key: string
): Promise<{ base64: string; mime: string } | null> {
  const styled =
    `${prompt}. Clean, modern SaaS illustration style` +
    (accent ? `, using #${accent} as the primary accent colour` : "") +
    `, against a dark background, flat vector aesthetic, no text or lettering anywhere in the image.`;
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title: unknown = body?.title;
  const slides: unknown = body?.slides;
  const projectId: unknown = body?.projectId;
  const qaRequested: boolean = body?.qa === true;
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

  let brand: { logoUrl?: string; accentColor?: string; backgroundColor?: string } = {};
  if (typeof projectId === "string" && projectId) {
    brand = await getBrandKit(createClient(), projectId);
  }

  // Generate one image per marker. Failures degrade that slide to text-only.
  let imageErrors = 0;
  const slideImages: SlideImage[] = [];
  const key = process.env.GEMINI_API_KEY;
  if (key && imagePrompts.length > 0) {
    const accentHex = normalizeHex(brand.accentColor) ?? undefined;
    for (const { slideIndex, prompt } of imagePrompts) {
      const img = await generateSlideImage(prompt, accentHex, key);
      if (img) slideImages.push({ slideIndex, base64: img.base64, mime: img.mime });
      else imageErrors++;
    }
  }

  let model = await buildDeckModel({ title, slides, slideImages, ...brand });

  // Optional visual QA: screenshot an HTML mirror of the same model, let a
  // vision model flag overflow/overlap/contrast, apply ONE deterministic fix
  // and re-check ONCE, then ship whatever we have with a note.
  let qaRan = false;
  let qaIssues: QaIssue[] = [];
  if (qaRequested && key) {
    try {
      let shots = await screenshotContentSlides(model);
      qaIssues = await reviewSlideShots(shots, key);
      if (qaIssues.length > 0) {
        const fixed = applyQaFixes(model, qaIssues);
        if (fixed.changed) {
          model = fixed.model;
          shots = await screenshotContentSlides(model);
          qaIssues = await reviewSlideShots(shots, key);
        }
      }
      qaRan = true;
    } catch {
      // Fail open - ship the deck without QA rather than not at all.
      qaRan = false;
      qaIssues = [];
    }
  }

  const buffer = await renderPptxFromModel(model);
  const filename = slugifyFilename(title);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}.pptx"`,
      "X-Image-Errors": String(imageErrors),
      "X-QA-Ran": qaRan ? "1" : "0",
      "X-QA-Notes": encodeURIComponent(qaRan ? qaNotesSentence(qaIssues) : ""),
    },
  });
}
