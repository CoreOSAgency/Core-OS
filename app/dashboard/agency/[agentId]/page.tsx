import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findAgent } from "@/lib/agents";
import AgentChatShell from "./AgentChatShell";

export default async function AgentChatPage({ params }: { params: { agentId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agent = findAgent(params.agentId);
  if (!agent || agent.id === "core") notFound();

  return (
    <AgentChatShell
      agent={agent}
      userEmail={user.email ?? ""}
      avatarUrl={(user.user_metadata?.avatar_url as string) ?? null}
    />
  );
}
