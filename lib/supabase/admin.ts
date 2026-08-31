import { createClient } from "@supabase/supabase-js";

// Service-role client for routes that legitimately run without a user session
// (public deck viewer, inbound webhooks). Returns null if the key isn't set so
// callers can degrade instead of throwing.
// ponytail: gated on SUPABASE_SERVICE_ROLE_KEY, same as the workflow webhook.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
