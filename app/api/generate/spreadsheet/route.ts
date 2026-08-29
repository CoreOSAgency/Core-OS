import { NextResponse } from "next/server";
import { generateXlsx } from "@/lib/spreadsheetGenerator";
import { slugifyFilename } from "@/lib/documentGenerators";

// Auth already enforced by middleware for all /api/* routes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title: unknown = body?.title;
  const data: unknown = body?.data;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object") {
    return NextResponse.json(
      { error: "data must be a non-empty array of objects" },
      { status: 400 }
    );
  }

  const buffer = generateXlsx(title, data as Record<string, unknown>[]);
  const filename = slugifyFilename(title);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
