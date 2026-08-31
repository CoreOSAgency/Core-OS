import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupChatShell from "./GroupChatShell";

export default async function GroupChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <GroupChatShell
      groupId={params.id}
      userEmail={user.email ?? ""}
      avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
    />
  );
}
