"use client";

import { useRouter } from "next/navigation";
import IconSidebar, { type IconSection } from "../IconSidebar";

export default function SettingsIconSidebar({
  userEmail,
  avatarUrl,
}: {
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();

  function onNavigate(section: IconSection) {
    if (section === "settings") return;
    if (section === "workflows") {
      router.push("/dashboard/workflows");
      return;
    }
    router.push(section === "dashboard" ? "/dashboard" : `/dashboard?view=${section}`);
  }

  return (
    <IconSidebar
      active="settings"
      onNavigate={onNavigate}
      userEmail={userEmail}
      avatarUrl={avatarUrl}
    />
  );
}
