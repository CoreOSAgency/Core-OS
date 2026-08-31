import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleDrive";

// A plain top-level navigation (not fetch) — middleware already requires a
// session for /api/*, so this only ever runs for a logged-in user.
// ?scope=expanded re-consents with Calendar + Gmail read scopes added.
export async function GET(request: Request) {
  const expanded = new URL(request.url).searchParams.get("scope") === "expanded";
  return NextResponse.redirect(getGoogleAuthUrl("connect", { expanded }));
}
