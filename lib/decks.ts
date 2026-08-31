import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import type { DeckModel } from "./deckModel";

export type Deck = {
  id: string;
  share_token: string;
  title: string;
  model: DeckModel;
  created_at: string;
};

// Authenticated create - RLS checks the project belongs to the caller.
export async function createDeck(
  supabase: SupabaseClient,
  projectId: string,
  title: string,
  model: DeckModel,
): Promise<{ shareToken: string }> {
  const { data, error } = await supabase
    .from("decks")
    .insert({ project_id: projectId, title, model })
    .select("share_token")
    .single();
  if (error) throw error;
  return { shareToken: data.share_token as string };
}

// Public lookup for the viewer / PDF routes - no session, service-role query
// by the unguessable share_token.
export async function getDeckByShareToken(shareToken: string): Promise<Deck | null> {
  if (!/^[0-9a-f-]{36}$/i.test(shareToken)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("decks")
    .select("id, share_token, title, model, created_at")
    .eq("share_token", shareToken)
    .maybeSingle();
  if (error || !data) return null;
  return data as Deck;
}
