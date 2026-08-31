import type { SupabaseClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.NOTION_CLIENT_ID;
const CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const REDIRECT_URI = process.env.NOTION_REDIRECT_URI;
const NOTION_VERSION = "2022-06-28";

function requireConfig(): { id: string; secret: string; redirect: string } {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error(
      "Notion integration is not configured — set NOTION_CLIENT_ID / NOTION_CLIENT_SECRET / NOTION_REDIRECT_URI"
    );
  }
  return { id: CLIENT_ID, secret: CLIENT_SECRET, redirect: REDIRECT_URI };
}

export function getNotionAuthUrl(state: string): string {
  const { id, redirect } = requireConfig();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    owner: "user",
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function saveNotionToken(
  supabase: SupabaseClient,
  userId: string,
  code: string
): Promise<void> {
  const { id, secret, redirect } = requireConfig();
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
    }),
  });
  if (!res.ok) throw new Error(`Notion token exchange failed: ${await res.text()}`);
  const tokens: { access_token: string } = await res.json();

  // ponytail: Notion access tokens don't expire — no refresh_token/expires_at.
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "notion",
      access_token: tokens.access_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function isNotionConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "notion")
    .maybeSingle();
  return !!data;
}

async function notionToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", userId)
    .eq("provider", "notion")
    .maybeSingle();
  return data?.access_token ?? null;
}

export type NotionPage = { id: string; title: string; url: string };

export async function notionSearch(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<NotionPage[]> {
  const token = await notionToken(supabase, userId);
  if (!token) throw new Error("Notion is not connected");

  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, page_size: 20 }),
  });
  if (!res.ok) throw new Error(`Notion search failed: ${await res.text()}`);
  const data: { results?: NotionResult[] } = await res.json();

  return (data.results ?? []).map((r) => ({
    id: r.id,
    url: r.url ?? "",
    title: notionTitle(r),
  }));
}

type NotionResult = {
  id: string;
  url?: string;
  properties?: Record<string, { type: string; title?: { plain_text: string }[] }>;
};

function notionTitle(r: NotionResult): string {
  for (const prop of Object.values(r.properties ?? {})) {
    if (prop.type === "title" && prop.title?.length) {
      return prop.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}
