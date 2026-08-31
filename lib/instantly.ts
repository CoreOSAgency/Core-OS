import type { SupabaseClient } from "@supabase/supabase-js";

// Instantly has no OAuth — the user pastes an API key from their account
// settings, same shape as the GoHighLevel webhook field.
export async function saveInstantlyKey(
  supabase: SupabaseClient,
  userId: string,
  apiKey: string
): Promise<void> {
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "instantly",
      access_token: apiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function isInstantlyConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "instantly")
    .maybeSingle();
  return !!data;
}

export type InstantlyCampaign = { id: string; name: string; status: number };

export async function instantlyListCampaigns(
  supabase: SupabaseClient,
  userId: string
): Promise<InstantlyCampaign[]> {
  const { data } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", "instantly")
    .maybeSingle();
  if (!data?.access_token) throw new Error("Instantly is not connected");

  const res = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=100", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (!res.ok) throw new Error(`Instantly campaign list failed: ${await res.text()}`);
  const body: { items?: InstantlyCampaign[] } = await res.json();
  return (body.items ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
  }));
}
