import type { SupabaseClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.SLACK_CLIENT_ID;
const CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = process.env.SLACK_REDIRECT_URI;
const SCOPES = "chat:write,channels:read";

function requireConfig(): { id: string; secret: string; redirect: string } {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error(
      "Slack integration is not configured — set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_REDIRECT_URI"
    );
  }
  return { id: CLIENT_ID, secret: CLIENT_SECRET, redirect: REDIRECT_URI };
}

export function getSlackAuthUrl(state: string): string {
  const { id, redirect } = requireConfig();
  const params = new URLSearchParams({
    client_id: id,
    scope: SCOPES,
    redirect_uri: redirect,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function saveSlackToken(
  supabase: SupabaseClient,
  userId: string,
  code: string
): Promise<void> {
  const { id, secret, redirect } = requireConfig();
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: redirect,
    }),
  });
  const data: { ok: boolean; access_token?: string; error?: string } = await res.json();
  if (!data.ok || !data.access_token) {
    throw new Error(`Slack token exchange failed: ${data.error ?? "unknown"}`);
  }

  // ponytail: bot tokens (xoxb-) don't expire — no refresh flow.
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "slack",
      access_token: data.access_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function isSlackConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .maybeSingle();
  return !!data;
}

async function slackToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", "slack")
    .maybeSingle();
  if (!data?.access_token) throw new Error("Slack is not connected");
  return data.access_token;
}

export type SlackChannel = { id: string; name: string };

export async function slackListChannels(
  supabase: SupabaseClient,
  userId: string
): Promise<SlackChannel[]> {
  const token = await slackToken(supabase, userId);
  const res = await fetch(
    "https://slack.com/api/conversations.list?exclude_archived=true&limit=200&types=public_channel",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data: { ok: boolean; channels?: SlackChannel[]; error?: string } = await res.json();
  if (!data.ok) throw new Error(`Slack channel list failed: ${data.error}`);
  return (data.channels ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export async function slackPostMessage(
  supabase: SupabaseClient,
  userId: string,
  channel: string,
  text: string
): Promise<void> {
  const token = await slackToken(supabase, userId);
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text }),
  });
  const data: { ok: boolean; error?: string } = await res.json();
  if (!data.ok) throw new Error(`Slack post failed: ${data.error}`);
}
