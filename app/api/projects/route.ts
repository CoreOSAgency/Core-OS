import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProject, listProjects } from "@/lib/projects";

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
  const description: unknown = body?.description;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = await createProject(
    supabase,
    user.id,
    name.trim(),
    typeof description === "string" ? description.trim() : undefined
  );
  return NextResponse.json({ project });
}
