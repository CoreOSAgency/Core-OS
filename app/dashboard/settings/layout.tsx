import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsNav from "./SettingsNav";
import SettingsIconSidebar from "./SettingsIconSidebar";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen bg-core-main">
      <SettingsIconSidebar
        userEmail={user.email ?? ""}
        avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
      />
      <SettingsNav />
      <main className="min-h-0 flex-1 overflow-y-auto bg-core-main">{children}</main>
    </div>
  );
}
