import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./googleDrive";

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string; // ISO datetime or date
  htmlLink: string;
};

// Read-only. Needs the expanded Google consent (calendar.readonly) — connect
// via /api/auth/google?scope=expanded first.
export async function listUpcomingEvents(
  supabase: SupabaseClient,
  userId: string,
  maxResults = 10
): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken(supabase, userId);
  if (!token) throw new Error("Google is not connected");

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Calendar list failed: ${await res.text()}`);

  const data: {
    items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; htmlLink?: string }[];
  } = await res.json();

  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    htmlLink: e.htmlLink ?? "",
  }));
}
