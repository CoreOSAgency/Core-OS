import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DomainVerificationStatus = "pending" | "verified" | "failed";
export type VerificationMethod = "dns_txt" | "file_upload";

export type ClientDomain = {
  id: string;
  project_id: string;
  domain: string;
  verification_status: DomainVerificationStatus;
  verification_method: VerificationMethod | null;
  verification_token: string | null;
  connected: boolean;
  dns_provider: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, project_id, domain, verification_status, verification_method, verification_token, connected, dns_provider, notes, created_at, updated_at";

// Strip protocol, path, port, leading www — leave the bare registrable host.
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  return d.replace(/^www\./, "");
}

export async function listDomains(
  supabase: SupabaseClient,
  projectId: string
): Promise<ClientDomain[]> {
  const { data, error } = await supabase
    .from("client_domains")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ClientDomain[];
}

export async function addDomain(
  supabase: SupabaseClient,
  projectId: string,
  rawDomain: string
): Promise<ClientDomain> {
  const domain = normalizeDomain(rawDomain);
  const verification_token = `coreos-verify-${randomBytes(16).toString("hex")}`;
  const { data, error } = await supabase
    .from("client_domains")
    .insert({ project_id: projectId, domain, verification_token, verification_status: "pending" })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as ClientDomain;
}

export async function deleteDomain(
  supabase: SupabaseClient,
  domainId: string
): Promise<void> {
  const { error } = await supabase.from("client_domains").delete().eq("id", domainId);
  if (error) throw error;
}

// Checks the real world; never throws — a lookup failure is just "failed".
export async function verifyDomain(
  domain: string,
  token: string,
  method: VerificationMethod
): Promise<DomainVerificationStatus> {
  try {
    if (method === "dns_txt") {
      const dns = await import("node:dns");
      const records = await dns.promises.resolveTxt(`_coreos-verify.${domain}`);
      const flat = records.flat().map((r) => r.trim());
      return flat.includes(token) ? "verified" : "failed";
    }
    const res = await fetch(`https://${domain}/.well-known/coreos-verify.txt`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "failed";
    return (await res.text()).trim() === token ? "verified" : "failed";
  } catch {
    return "failed";
  }
}

export async function markVerification(
  supabase: SupabaseClient,
  domainId: string,
  status: DomainVerificationStatus,
  method: VerificationMethod
): Promise<ClientDomain> {
  const { data, error } = await supabase
    .from("client_domains")
    .update({
      verification_status: status,
      verification_method: method,
      connected: status === "verified",
      updated_at: new Date().toISOString(),
    })
    .eq("id", domainId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as ClientDomain;
}

export async function getDomain(
  supabase: SupabaseClient,
  domainId: string
): Promise<ClientDomain | null> {
  const { data, error } = await supabase
    .from("client_domains")
    .select(COLUMNS)
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ClientDomain) ?? null;
}
