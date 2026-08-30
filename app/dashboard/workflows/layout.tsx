import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkflowsIconSidebar from "./WorkflowsIconSidebar";

export default async function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen bg-core-main">
      <WorkflowsIconSidebar
        userEmail={user.email ?? ""}
        avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
      />
      <main className="min-h-0 flex-1 overflow-hidden bg-core-main">{children}</main>
    </div>
  );
}
