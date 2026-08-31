import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findAgent } from "@/lib/agents";
import { createGroupConversation, listGroupConversations } from "@/lib/conversations";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await listGroupConversations(supabase, params.id);
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw: unknown = body?.agentIds;
  const agentIds = Array.isArray(raw)
    ? Array.from(
        new Set(raw.filter((a): a is string => typeof a === "string" && !!findAgent(a)))
      )
    : [];
  if (agentIds.length < 1 || agentIds.length > 8) {
    return NextResponse.json(
      { error: "A group chat needs 1 to 8 valid agents" },
      { status: 400 }
    );
  }
  const seedFrom =
    typeof body?.seedFromConversationId === "string" && body.seedFromConversationId
      ? body.seedFromConversationId
      : undefined;

  // RLS rejects the inserts (and the seed read) if the caller doesn't own
  // the project / seed conversation.
  const conversation = await createGroupConversation(
    supabase,
    params.id,
    agentIds,
    seedFrom
  );
  return NextResponse.json({ conversation });
}
