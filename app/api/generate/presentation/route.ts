import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/projects";
import { generatePptx } from "@/lib/presentationGenerator";
import { slugifyFilename } from "@/lib/documentGenerators";

// Auth already enforced by middleware for all /api/* routes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title: unknown = body?.title;
  const slides: unknown = body?.slides;
  const projectId: unknown = body?.projectId;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { error: "slides must be a non-empty array" },
      { status: 400 }
    );
  }

  // The deck carries the client's brand, never CoreOS's. RLS scopes the
  // context read to a project the caller owns.
  let brand: { logoUrl?: string; accentColor?: string } = {};
  if (typeof projectId === "string" && projectId) {
    brand = await getBrandKit(createClient(), projectId);
  }

  const buffer = await generatePptx({ title, slides, ...brand });
  const filename = slugifyFilename(title);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}.pptx"`,
    },
  });
}
