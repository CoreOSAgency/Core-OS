import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveInstantlyKey } from "@/lib/instantly";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const apiKey: unknown = body?.apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  await saveInstantlyKey(supabase, user.id, apiKey.trim());
  return NextResponse.json({ ok: true });
}
