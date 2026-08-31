import type { SupabaseClient } from "@supabase/supabase-js";

export type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
  participant_agent_ids: string[];
};

export type GroundingSource = { title: string; url: string };

export type StoredMessage = {
  role: "user" | "model";
  content: string;
  context_saved: boolean;
  is_deliverable: boolean;
  mode: string;
  model_used: string | null;
  thinking_level: string | null;
  grounding_sources: GroundingSource[];
  agent_id: string | null;
};

export async function listConversations(
  supabase: SupabaseClient,
  projectId: string,
  agentId: string
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at, conversation_participants(agent_id)")
    .eq("project_id", projectId)
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      title: string | null;
      updated_at: string;
      conversation_participants: { agent_id: string }[] | null;
    };
    return {
      id: r.id,
      title: r.title,
      updated_at: r.updated_at,
      participant_agent_ids: (r.conversation_participants ?? []).map((p) => p.agent_id),
    };
  });
}

export async function createConversation(
  supabase: SupabaseClient,
  projectId: string,
  agentId: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, agent_id: agentId })
    .select("id, title, updated_at")
    .single();

  if (error) throw error;
  // The starting agent becomes the first participant; route.ts also upserts
  // this, but doing it here keeps a freshly created conversation consistent.
  await addParticipant(supabase, data.id, agentId);
  return { ...data, participant_agent_ids: [agentId] };
}

export async function listParticipants(
  supabase: SupabaseClient,
  conversationId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("agent_id")
    .eq("conversation_id", conversationId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.agent_id as string);
}

// Idempotent: does nothing if the agent is already a participant.
export async function addParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  agentId: string
): Promise<void> {
  const { error } = await supabase
    .from("conversation_participants")
    .upsert(
      { conversation_id: conversationId, agent_id: agentId },
      { onConflict: "conversation_id,agent_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function getMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "role, content, context_saved, is_deliverable, mode, model_used, thinking_level, grounding_sources, agent_id"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Appends the user/model pair from one chat turn, and — for a fresh
// conversation — titles it from the user's first message and bumps
// updated_at so it sorts to the top of the history list.
export async function appendTurn(
  supabase: SupabaseClient,
  conversationId: string,
  userText: string,
  modelText: string,
  meta: {
    contextSaved: boolean;
    isDeliverable: boolean;
    mode: string;
    modelUsed: string;
    thinkingLevel: string;
    groundingSources: GroundingSource[];
    agentId: string;
  }
): Promise<void> {
  // Both rows list every column explicitly — a batch insert where rows have
  // different keys sends NULL (not the column default) for the missing
  // ones, which violates these not-null constraints.
  const { error: insertError } = await supabase.from("messages").insert([
    {
      conversation_id: conversationId,
      role: "user",
      content: userText,
      context_saved: false,
      is_deliverable: false,
      mode: meta.mode,
      model_used: null,
      thinking_level: null,
      grounding_sources: [],
      agent_id: null,
    },
    {
      conversation_id: conversationId,
      role: "model",
      content: modelText,
      context_saved: meta.contextSaved,
      is_deliverable: meta.isDeliverable,
      mode: meta.mode,
      model_used: meta.modelUsed,
      thinking_level: meta.thinkingLevel,
      grounding_sources: meta.groundingSources,
      agent_id: meta.agentId,
    },
  ]);
  if (insertError) throw insertError;

  const { data: existing } = await supabase
    .from("conversations")
    .select("title")
    .eq("id", conversationId)
    .single();

  const update: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };
  if (!existing?.title) {
    update.title = userText.slice(0, 60);
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", conversationId);
  if (updateError) throw updateError;
}
