import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteProjectContextKey,
  getProjectContext,
  saveProjectContext,
} from "@/lib/projects";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS scopes this to projects the caller owns — a foreign/unknown id just
  // comes back empty rather than needing a separate ownership check here.
  const context = await getProjectContext(supabase, params.id);
  return NextResponse.json({ context });
}

// Upsert one or more entries. Also how a single entry gets edited — posting
// {entries: {key: newValue}} overwrites that key.
export async function POST(
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
  const entries = body?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return NextResponse.json(
      { error: "entries object is required" },
      { status: 400 }
    );
  }

  await saveProjectContext(supabase, params.id, entries);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  await deleteProjectContextKey(supabase, params.id, key);
  return NextResponse.json({ ok: true });
}
