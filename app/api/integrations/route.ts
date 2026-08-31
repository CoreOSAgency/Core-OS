import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleDriveConnected } from "@/lib/googleDrive";
import { isNotionConnected } from "@/lib/notion";
import { isSlackConnected } from "@/lib/slack";
import { isInstantlyConnected } from "@/lib/instantly";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [googleDrive, notion, slack, instantly] = await Promise.all([
    isGoogleDriveConnected(supabase, user.id),
    isNotionConnected(supabase, user.id),
    isSlackConnected(supabase, user.id),
    isInstantlyConnected(supabase, user.id),
  ]);
  return NextResponse.json({ googleDrive, notion, slack, instantly });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  return NextResponse.json({ ok: true });
}
