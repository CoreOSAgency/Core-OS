import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findAgent } from "@/lib/agents";
import {
  addParticipant,
  listParticipants,
  removeParticipant,
  renameGroupToParticipants,
} from "@/lib/conversations";

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
  const participants = await listParticipants(supabase, params.id);
  return NextResponse.json({ participants });
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
  const agentId: unknown = body?.agentId;
  if (typeof agentId !== "string" || !findAgent(agentId)) {
    return NextResponse.json({ error: "Unknown agentId" }, { status: 400 });
  }

  // RLS rejects the insert if the caller doesn't own the conversation.
  await addParticipant(supabase, params.id, agentId);
  await renameGroupToParticipants(supabase, params.id);
  const participants = await listParticipants(supabase, params.id);
  return NextResponse.json({ participants });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const agentId: unknown = body?.agentId;
  if (typeof agentId !== "string") {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  try {
    const participants = await removeParticipant(supabase, params.id, agentId);
    return NextResponse.json({ participants });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't remove that agent" },
      { status: 400 }
    );
  }
}
