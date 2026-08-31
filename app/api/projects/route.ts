import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject, listProjects, type ClientStatus, type ProjectUpdate } from "@/lib/projects";

const STATUSES: ClientStatus[] = ["lead", "onboarding", "active", "paused", "churned"];

const NULLABLE_TEXT_FIELDS = [
  "description",
  "industry",
  "website_url",
  "primary_contact_name",
  "primary_contact_email",
] as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await listProjects(supabase, user.id);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: unknown = body?.name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const fields: { name: string } & Omit<ProjectUpdate, "name"> = { name: name.trim() };

  for (const field of NULLABLE_TEXT_FIELDS) {
    const value = body?.[field];
    if (typeof value === "string" && value.trim()) fields[field] = value.trim();
  }
  if (typeof body?.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    fields.status = body.status;
  }

  const project = await createProject(supabase, user.id, fields);
  return NextResponse.json({ project });
}
