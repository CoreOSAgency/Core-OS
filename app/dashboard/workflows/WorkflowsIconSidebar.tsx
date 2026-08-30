"use client";

import { useRouter } from "next/navigation";
import IconSidebar from "../IconSidebar";

export default function WorkflowsIconSidebar({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  return (
    <IconSidebar
      onDashboard={() => router.push("/dashboard")}
      onAgency={() => router.push("/dashboard?view=agency")}
      agencyActive={false}
      userEmail={userEmail}
    />
  );
}
