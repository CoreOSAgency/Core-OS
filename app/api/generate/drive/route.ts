import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, uploadToDrive } from "@/lib/googleDrive";
import { generateDocx, generatePdf } from "@/lib/documentGenerators";
import { generateXlsx } from "@/lib/spreadsheetGenerator";
import { generatePptx } from "@/lib/presentationGenerator";
import { getProjectContext } from "@/lib/projects";

type FileType = "pdf" | "docx" | "xlsx" | "pptx";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken(supabase, user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google Drive isn't connected. Connect it from Integrations first." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const type: unknown = body?.type;
  const title: unknown = body?.title;
  const projectId: unknown = body?.projectId;

  if (type !== "pdf" && type !== "docx" && type !== "xlsx" && type !== "pptx") {
    return NextResponse.json(
      { error: "type must be pdf, docx, xlsx, or pptx" },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  let folderId: string | undefined;
  if (typeof projectId === "string" && projectId) {
    const context = await getProjectContext(supabase, projectId);
    folderId = context.google_drive_folder_id || undefined;
  }

  let bytes: Uint8Array;
  try {
    bytes = await generateBytes(type, body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't generate that file" },
      { status: 400 }
    );
  }

  try {
    const file = await uploadToDrive({
      accessToken,
      name: title,
      fileType: type,
      bytes,
      folderId,
    });
    return NextResponse.json({ webViewLink: file.webViewLink });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Drive upload failed" },
      { status: 502 }
    );
  }
}

type DriveRequestBody = {
  title: string;
  content?: string;
  data?: Record<string, unknown>[];
  slides?: { heading: string; bullets: string[] }[];
  projectName?: string;
  agentName?: string;
};

async function generateBytes(type: FileType, body: unknown): Promise<Uint8Array> {
  const b = body as DriveRequestBody;
  const shared = {
    title: b.title,
    projectName: typeof b.projectName === "string" ? b.projectName : undefined,
    agentName: typeof b.agentName === "string" ? b.agentName : undefined,
  };

  if (type === "pdf") return generatePdf({ ...shared, content: b.content ?? "" });
  if (type === "docx") return new Uint8Array(await generateDocx({ ...shared, content: b.content ?? "" }));
  if (type === "xlsx") {
    if (!Array.isArray(b.data) || b.data.length === 0) {
      throw new Error("data must be a non-empty array");
    }
    return new Uint8Array(generateXlsx(shared.title, b.data));
  }
  // pptx
  if (!Array.isArray(b.slides) || b.slides.length === 0) {
    throw new Error("slides must be a non-empty array");
  }
  return new Uint8Array(await generatePptx({ ...shared, slides: b.slides }));
}
