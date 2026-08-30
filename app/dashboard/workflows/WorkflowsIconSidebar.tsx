"use client";

import { useRouter } from "next/navigation";
import IconSidebar, { type IconSection } from "../IconSidebar";

export default function WorkflowsIconSidebar({
  userEmail,
  avatarUrl,
}: {
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();

  function onNavigate(section: IconSection) {
    if (section === "workflows") return;
    if (section === "settings") {
      router.push("/dashboard/settings/organization");
      return;
    }
    router.push(section === "dashboard" ? "/dashboard" : `/dashboard?view=${section}`);
  }

  return (
    <IconSidebar
      active="workflows"
      onNavigate={onNavigate}
      userEmail={userEmail}
      avatarUrl={avatarUrl}
    />
  );
}
