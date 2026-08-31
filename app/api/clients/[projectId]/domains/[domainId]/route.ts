import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDomain } from "@/lib/domains";

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string; domainId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS scopes the delete to domains under projects the caller owns.
  await deleteDomain(supabase, params.domainId);
  return NextResponse.json({ ok: true });
}
