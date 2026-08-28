import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAgencyContext, saveAgencyContext } from "@/lib/agencyContext";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await getAgencyContext(supabase, user.id);
  return NextResponse.json({ context });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const entries = body?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return NextResponse.json(
      { error: "entries object is required" },
      { status: 400 }
    );
  }

  await saveAgencyContext(supabase, user.id, entries);
  return NextResponse.json({ ok: true });
}
