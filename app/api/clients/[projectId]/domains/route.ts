import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addDomain, listDomains } from "@/lib/domains";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes this to a project the caller owns.
  const domains = await listDomains(supabase, params.projectId);
  return NextResponse.json({ domains });
}

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.domain !== "string" || !body.domain.trim()) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  try {
    const domain = await addDomain(supabase, params.projectId, body.domain);
    return NextResponse.json({ domain });
  } catch (err) {
    if ((err as { code?: string })?.code === "23505") {
      return NextResponse.json({ error: "That domain is already added" }, { status: 409 });
    }
    throw err;
  }
}
