import type { SupabaseClient } from "@supabase/supabase-js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const SCOPE = "https://www.googleapis.com/auth/drive.file";

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function saveGoogleTokens(
  supabase: SupabaseClient,
  userId: string,
  tokens: TokenResponse
): Promise<void> {
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      provider: "google_drive",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
}

export async function isGoogleDriveConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_integrations")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "google_drive")
    .maybeSingle();
  return !!data;
}

// Returns a valid access token, transparently refreshing (and persisting
// the refresh) if the stored one has expired. Null if never connected.
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google_drive")
    .maybeSingle();

  if (error || !data?.access_token) return null;

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return data.access_token;

  if (!data.refresh_token) return null;
  const refreshed = await refreshAccessToken(data.refresh_token);

  await supabase
    .from("user_integrations")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google_drive");

  return refreshed.access_token;
}

// Google mime types Drive auto-converts an upload into, so it opens as a
// real Doc/Sheet/Slide rather than sitting as a downloaded PDF/docx/etc.
const TARGET_MIME_TYPE: Record<string, string | null> = {
  pdf: null, // no native Drive equivalent — stored as-is
  docx: "application/vnd.google-apps.document",
  xlsx: "application/vnd.google-apps.spreadsheet",
  pptx: "application/vnd.google-apps.presentation",
};

const SOURCE_MIME_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export async function uploadToDrive({
  accessToken,
  name,
  fileType,
  bytes,
  folderId,
}: {
  accessToken: string;
  name: string;
  fileType: "pdf" | "docx" | "xlsx" | "pptx";
  bytes: Uint8Array;
  folderId?: string;
}): Promise<{ id: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: TARGET_MIME_TYPE[fileType] ?? SOURCE_MIME_TYPE[fileType],
  };
  if (folderId) metadata.parents = [folderId];

  const boundary = "coreos-drive-upload-boundary";
  const bodyParts = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${SOURCE_MIME_TYPE[fileType]}\r\n\r\n`,
  ];
  const closing = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const body = new Blob([
    encoder.encode(bodyParts[0]),
    encoder.encode(bodyParts[1]),
    new Uint8Array(bytes),
    encoder.encode(closing),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
  return res.json();
}

// Accepts a full Drive folder URL or a bare folder ID either way.
export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}
