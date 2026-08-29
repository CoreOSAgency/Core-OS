import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, saveGoogleTokens } from "@/lib/googleDrive";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError || !code) {
    return NextResponse.redirect(`${origin}/dashboard?integration=error`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveGoogleTokens(supabase, user.id, tokens);
    return NextResponse.redirect(`${origin}/dashboard?integration=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard?integration=error`);
  }
}
