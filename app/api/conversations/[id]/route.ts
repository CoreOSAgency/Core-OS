import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConversation } from "@/lib/conversations";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes this to conversations under projects the caller owns.
  const conversation = await getConversation(supabase, params.id);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation });
}
