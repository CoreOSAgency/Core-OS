import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProject, type ClientStatus, type ProjectUpdate } from "@/lib/projects";

const STATUSES: ClientStatus[] = ["lead", "onboarding", "active", "paused", "churned"];

// Nullable text fields — can be set or cleared back to null. `name` is
// handled separately since it can't be blanked.
const NULLABLE_TEXT_FIELDS = [
  "description",
  "industry",
  "website_url",
  "primary_contact_name",
  "primary_contact_email",
] as const;

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
  const updates: ProjectUpdate = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }

  for (const field of NULLABLE_TEXT_FIELDS) {
    const value = body?.[field];
    if (typeof value !== "string") continue;
    updates[field] = value.trim() || null;
  }

  if (typeof body?.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // RLS scopes the update to projects the caller owns.
  const project = await updateProject(supabase, params.id, updates);
  return NextResponse.json({ project });
}
