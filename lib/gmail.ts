import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./googleDrive";

export type GmailMessage = { id: string; subject: string; from: string; snippet: string };

// Read-only. Needs the expanded Google consent (gmail.readonly) — connect via
// /api/auth/google?scope=expanded first. No send: agents draft in the chat,
// the user sends from their own client.
export async function listRecentMessages(
  supabase: SupabaseClient,
  userId: string,
  maxResults = 10
): Promise<GmailMessage[]> {
  const token = await getValidAccessToken(supabase, userId);
  if (!token) throw new Error("Google is not connected");
  const auth = { Authorization: `Bearer ${token}` };

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    { headers: auth }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`);
  const list: { messages?: { id: string }[] } = await listRes.json();

  // ponytail: one metadata GET per message — fine for maxResults ~10. Switch
  // to the batch endpoint if this ever pulls hundreds.
  return Promise.all(
    (list.messages ?? []).map(async ({ id }) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: auth }
      );
      const msg: {
        snippet?: string;
        payload?: { headers?: { name: string; value: string }[] };
      } = await res.json();
      const header = (n: string) =>
        msg.payload?.headers?.find((h) => h.name === n)?.value ?? "";
      return {
        id,
        subject: header("Subject") || "(no subject)",
        from: header("From"),
        snippet: msg.snippet ?? "",
      };
    })
  );
}
