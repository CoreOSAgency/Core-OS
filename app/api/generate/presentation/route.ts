import { NextResponse } from "next/server";
import { generatePptx } from "@/lib/presentationGenerator";
import { slugifyFilename } from "@/lib/documentGenerators";

// Auth already enforced by middleware for all /api/* routes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title: unknown = body?.title;
  const slides: unknown = body?.slides;
  const projectName: unknown = body?.projectName;
  const agentName: unknown = body?.agentName;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { error: "slides must be a non-empty array" },
      { status: 400 }
    );
  }

  const buffer = await generatePptx({
    title,
    slides,
    projectName: typeof projectName === "string" ? projectName : undefined,
    agentName: typeof agentName === "string" ? agentName : undefined,
  });
  const filename = slugifyFilename(title);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${filename}.pptx"`,
    },
  });
}
