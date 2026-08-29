import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleDriveConnected } from "@/lib/googleDrive";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleDrive = await isGoogleDriveConnected(supabase, user.id);
  return NextResponse.json({ googleDrive });
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
