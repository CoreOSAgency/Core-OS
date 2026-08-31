import { NextResponse } from "next/server";
import { getSlackAuthUrl } from "@/lib/slack";

// Plain top-level navigation — middleware already requires a session for /api/*.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  try {
    return NextResponse.redirect(getSlackAuthUrl("connect"));
  } catch {
    return NextResponse.redirect(
      `${origin}/dashboard/settings/integrations?integration=error`
    );
  }
}
