import type { SupabaseClient } from "@supabase/supabase-js";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export async function listProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
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
    .select("id, name, description, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  updates: { name?: string; description?: string }
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select("id, name, description, created_at")
    .single();

  if (error) throw error;
  return data;
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
