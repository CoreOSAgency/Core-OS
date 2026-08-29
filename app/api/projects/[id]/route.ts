import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProject } from "@/lib/projects";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const updates: { name?: string; description?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body?.description === "string") updates.description = body.description.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // RLS scopes the update to projects the caller owns.
  const project = await updateProject(supabase, params.id, updates);
  return NextResponse.json({ project });
}
