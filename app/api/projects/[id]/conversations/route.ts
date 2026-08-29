import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createConversation, listConversations } from "@/lib/conversations";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  // RLS scopes this to projects the caller owns.
  const conversations = await listConversations(supabase, params.id, agentId);
  return NextResponse.json({ conversations });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const agentId: unknown = body?.agentId;
  if (typeof agentId !== "string" || !agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const conversation = await createConversation(supabase, params.id, agentId);
  return NextResponse.json({ conversation });
}
