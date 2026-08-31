import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDomain, markVerification, verifyDomain, type VerificationMethod } from "@/lib/domains";

const METHODS: VerificationMethod[] = ["dns_txt", "file_upload"];

export async function POST(
  request: Request,
  { params }: { params: { projectId: string; domainId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const method: unknown = body?.method;
  if (typeof method !== "string" || !METHODS.includes(method as VerificationMethod)) {
    return NextResponse.json({ error: "method must be dns_txt or file_upload" }, { status: 400 });
  }

  // RLS scopes this select — a foreign/unknown id just comes back null.
  const domain = await getDomain(supabase, params.domainId);
  if (!domain || !domain.verification_token) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const status = await verifyDomain(
    domain.domain,
    domain.verification_token,
    method as VerificationMethod
  );
  const updated = await markVerification(
    supabase,
    params.domainId,
    status,
    method as VerificationMethod
  );
  return NextResponse.json({ domain: updated });
}
