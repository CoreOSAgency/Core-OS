import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleDrive";

// A plain top-level navigation (not fetch) — middleware already requires a
// session for /api/*, so this only ever runs for a logged-in user.
export async function GET() {
  return NextResponse.redirect(getGoogleAuthUrl("connect"));
}
