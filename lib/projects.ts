import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientStatus = "lead" | "onboarding" | "active" | "paused" | "churned";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  industry: string | null;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  status: ClientStatus;
  archived_at: string | null;
};

// Every select of a project row goes through this so all callers get the
// full shape — add a column here when the migration adds one.
const PROJECT_COLUMNS =
  "id, name, description, created_at, industry, website_url, primary_contact_name, primary_contact_email, status, archived_at";

// Structured fields a caller may patch (name/description plus the Phase 1
// client columns). Brand colours/tone/logo still go through project_context.
export type ProjectUpdate = Partial<
  Pick<
    Project,
    | "name"
    | "description"
    | "industry"
    | "website_url"
    | "primary_contact_name"
    | "primary_contact_email"
    | "status"
    | "archived_at"
  >
>;

export async function listProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Project[];
}

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  description?: string
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name, description: description ?? null })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  updates: ProjectUpdate
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as Project;
}

export async function getProjectContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("project_context")
    .select("key, value")
    .eq("project_id", projectId);

  if (error) throw error;
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export async function saveProjectContext(
  supabase: SupabaseClient,
  projectId: string,
  entries: Record<string, string>
): Promise<void> {
  const rows = Object.entries(entries)
    .filter(([key, value]) => key && typeof value === "string" && value.trim())
    .map(([key, value]) => ({ project_id: projectId, key, value }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("project_context")
    .upsert(rows, { onConflict: "project_id,key" });

  if (error) throw error;
}

export async function deleteProjectContextKey(
  supabase: SupabaseClient,
  projectId: string,
  key: string
): Promise<void> {
  const { error } = await supabase
    .from("project_context")
    .delete()
    .eq("project_id", projectId)
    .eq("key", key);

  if (error) throw error;
}

// Exact format requested: one line per entry, "PROJECT CONTEXT: [key]: [value]".
export function formatProjectContextForPrompt(
  context: Record<string, string>
): string {
  const entries = Object.entries(context);
  if (entries.length === 0) return "";

  return (
    "\n\n" +
    entries.map(([key, value]) => `PROJECT CONTEXT: ${key}: ${value}`).join("\n")
  );
}
