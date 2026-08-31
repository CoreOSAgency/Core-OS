import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveSlackToken } from "@/lib/slack";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const done = `${origin}/dashboard/settings/integrations`;

  if (oauthError || !code) {
    return NextResponse.redirect(`${done}?integration=error`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    await saveSlackToken(supabase, user.id, code);
    return NextResponse.redirect(`${done}?integration=connected`);
  } catch {
    return NextResponse.redirect(`${done}?integration=error`);
  }
}
