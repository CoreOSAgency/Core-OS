import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, uploadToDrive } from "@/lib/googleDrive";
import { generateDocx, generatePdf } from "@/lib/documentGenerators";
import { generateXlsx } from "@/lib/spreadsheetGenerator";
import { getBrandKit, getProjectContext } from "@/lib/projects";

// Decks are shareable links now (Phase 13), not files - no pptx here.
type FileType = "pdf" | "docx" | "xlsx";

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

  if (type !== "pdf" && type !== "docx" && type !== "xlsx") {
    return NextResponse.json(
      { error: "type must be pdf, docx, or xlsx" },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  let folderId: string | undefined;
  let brand: { logoUrl?: string; accentColor?: string } = {};
  if (typeof projectId === "string" && projectId) {
    const context = await getProjectContext(supabase, projectId);
    folderId = context.google_drive_folder_id || undefined;
    brand = await getBrandKit(supabase, projectId);
  }

  let bytes: Uint8Array;
  try {
    bytes = await generateBytes(type, body, brand);
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
  projectName?: string;
  agentName?: string;
};

async function generateBytes(
  type: FileType,
  body: unknown,
  brand: { logoUrl?: string; accentColor?: string }
): Promise<Uint8Array> {
  const b = body as DriveRequestBody;
  const shared = { title: b.title, ...brand };

  if (type === "pdf") return generatePdf({ ...shared, content: b.content ?? "" });
  if (type === "docx") return new Uint8Array(await generateDocx({ ...shared, content: b.content ?? "" }));
  // xlsx
  if (!Array.isArray(b.data) || b.data.length === 0) {
    throw new Error("data must be a non-empty array");
  }
  return new Uint8Array(generateXlsx(shared.title, b.data));
}
