import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandKit } from "@/lib/projects";
import { generateDocx, generatePdf, slugifyFilename } from "@/lib/documentGenerators";

// Auth is already enforced by middleware for all /api/* routes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type: unknown = body?.type;
  const title: unknown = body?.title;
  const content: unknown = body?.content;
  const projectId: unknown = body?.projectId;

  if (type !== "pdf" && type !== "docx") {
    return NextResponse.json({ error: "type must be 'pdf' or 'docx'" }, { status: 400 });
  }
  if (typeof title !== "string" || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  let brand: { logoUrl?: string; accentColor?: string; backgroundColor?: string } = {};
  if (typeof projectId === "string" && projectId) {
    brand = await getBrandKit(createClient(), projectId);
  }

  const input = { title, content, ...brand };
  const filename = slugifyFilename(title);

  if (type === "pdf") {
    const bytes = await generatePdf(input);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  const buffer = await generateDocx(input);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
    },
  });
}
