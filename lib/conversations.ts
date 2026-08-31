import type { SupabaseClient } from "@supabase/supabase-js";
import { groupName } from "@/lib/agents";

export type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
  kind: "agent" | "group";
  participant_agent_ids: string[];
};

const CONV_SELECT = "id, title, updated_at, kind, conversation_participants(agent_id)";

function mapConversation(row: unknown): Conversation {
  const r = row as {
    id: string;
    title: string | null;
    updated_at: string;
    kind?: "agent" | "group";
    conversation_participants: { agent_id: string }[] | null;
  };
  return {
    id: r.id,
    title: r.title,
    updated_at: r.updated_at,
    kind: r.kind ?? "agent",
    participant_agent_ids: (r.conversation_participants ?? []).map((p) => p.agent_id),
  };
}

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
    .select(CONV_SELECT)
    .eq("project_id", projectId)
    .eq("agent_id", agentId)
    .eq("kind", "agent")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapConversation);
}

// Group chats for a project - the "GROUP CHATS" section of the agent nav.
export async function listGroupConversations(
  supabase: SupabaseClient,
  projectId: string
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONV_SELECT)
    .eq("project_id", projectId)
    .eq("kind", "group")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapConversation);
}

export async function getConversation(
  supabase: SupabaseClient,
  id: string
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONV_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapConversation(data) : null;
}

export async function createConversation(
  supabase: SupabaseClient,
  projectId: string,
  agentId: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, agent_id: agentId, kind: "agent" })
    .select("id, title, updated_at")
    .single();

  if (error) throw error;
  await addParticipant(supabase, data.id, agentId);
  return { ...data, kind: "agent", participant_agent_ids: [agentId] };
}

// A named multi-agent room. Optionally seeded with a copy of another
// conversation's messages so a handoff carries its context.
export async function createGroupConversation(
  supabase: SupabaseClient,
  projectId: string,
  agentIds: string[],
  seedFromConversationId?: string
): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      project_id: projectId,
      agent_id: null,
      kind: "group",
      title: groupName(agentIds),
    })
    .select("id, title, updated_at")
    .single();
  if (error) throw error;

  for (const agentId of agentIds) {
    await addParticipant(supabase, data.id, agentId);
  }

  if (seedFromConversationId) {
    const seed = await getMessages(supabase, seedFromConversationId);
    if (seed.length > 0) {
      const { error: seedErr } = await supabase.from("messages").insert(
        seed.map((m) => ({
          conversation_id: data.id,
          role: m.role,
          content: m.content,
          context_saved: m.context_saved,
          is_deliverable: m.is_deliverable,
          mode: m.mode,
          model_used: m.model_used,
          thinking_level: m.thinking_level,
          grounding_sources: m.grounding_sources,
          agent_id: m.agent_id,
        }))
      );
      if (seedErr) throw seedErr;
    }
  }

  return { ...data, kind: "group", participant_agent_ids: [...agentIds] };
}

// Removes an agent from a group. Refuses to leave a group empty.
export async function removeParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  agentId: string
): Promise<string[]> {
  const current = await listParticipants(supabase, conversationId);
  if (current.length <= 1) {
    throw new Error("A group chat needs at least one agent");
  }
  const { error } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("agent_id", agentId);
  if (error) throw error;
  const next = current.filter((id) => id !== agentId);
  await renameGroupToParticipants(supabase, conversationId, next);
  return next;
}

// Keeps a group's auto-name in sync with its membership.
export async function renameGroupToParticipants(
  supabase: SupabaseClient,
  conversationId: string,
  agentIds?: string[]
): Promise<void> {
  const ids = agentIds ?? (await listParticipants(supabase, conversationId));
  await supabase
    .from("conversations")
    .update({ title: groupName(ids) })
    .eq("id", conversationId)
    .eq("kind", "group");
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
