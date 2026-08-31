import { NextResponse } from "next/server";
import { getNotionAuthUrl } from "@/lib/notion";

// Plain top-level navigation — middleware already requires a session for /api/*.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  try {
    return NextResponse.redirect(getNotionAuthUrl("connect"));
  } catch {
    return NextResponse.redirect(
      `${origin}/dashboard/settings/integrations?integration=error`
    );
  }
}
