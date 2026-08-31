import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDocx, generatePdf, slugifyFilename } from "@/lib/documentGenerators";
import { clientReportMarkdown, getClientReport } from "@/lib/reports";

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf";

  const report = await getClientReport(supabase, params.projectId);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = {
    title: `${report.projectName} — Client Report`,
    content: clientReportMarkdown(report),
    projectName: report.projectName,
    agentName: "CoreOS Reports",
  };
  const filename = slugifyFilename(input.title);

  if (format === "pdf") {
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
