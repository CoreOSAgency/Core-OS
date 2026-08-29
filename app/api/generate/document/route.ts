import { NextResponse } from "next/server";
import { generateDocx, generatePdf, slugifyFilename } from "@/lib/documentGenerators";

// Auth is already enforced by middleware for all /api/* routes; this route
// needs no user-specific data, so it doesn't repeat the check.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const type: unknown = body?.type;
  const title: unknown = body?.title;
  const content: unknown = body?.content;
  const projectName: unknown = body?.projectName;
  const agentName: unknown = body?.agentName;

  if (type !== "pdf" && type !== "docx") {
    return NextResponse.json({ error: "type must be 'pdf' or 'docx'" }, { status: 400 });
  }
  if (typeof title !== "string" || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const input = {
    title,
    content,
    projectName: typeof projectName === "string" ? projectName : undefined,
    agentName: typeof agentName === "string" ? agentName : undefined,
  };

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
