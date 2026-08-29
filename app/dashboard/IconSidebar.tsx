"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavIcon({
  label,
  active,
  disabled,
  onClick,
  href,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const className = `flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
    active
      ? "bg-core-purple/20 text-core-purple"
      : disabled
        ? "cursor-default text-neutral-700"
        : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
  }`;

  if (href && !disabled) {
    return (
      <Link href={href} title={label} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export default function IconSidebar({
  onDashboard,
  onAgency,
  agencyActive,
  userEmail,
}: {
  onDashboard: () => void;
  onAgency: () => void;
  agencyActive: boolean;
  userEmail: string;
}) {
  const pathname = usePathname();
  const onSettings = pathname.startsWith("/dashboard/settings");
  const initial = userEmail.trim().charAt(0).toUpperCase() || "?";

  return (
    <nav className="flex h-full w-[50px] shrink-0 flex-col items-center justify-between border-r border-white/5 bg-core-icon py-3">
      <div className="flex flex-col items-center gap-1">
        <Link
          href="/dashboard"
          title="CoreOS"
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-core-purple text-xs font-bold text-white"
        >
          C
        </Link>
        <NavIcon label="Dashboard" active={!onSettings && !agencyActive} onClick={onDashboard}>
          🏠
        </NavIcon>
        <NavIcon label="Agency" active={!onSettings && agencyActive} onClick={onAgency}>
          🗂
        </NavIcon>
        <NavIcon label="Clients (coming soon)" disabled>
          👥
        </NavIcon>
        <NavIcon label="Files (coming soon)" disabled>
          📁
        </NavIcon>
        <NavIcon label="Domains (coming soon)" disabled>
          🌐
        </NavIcon>
        <NavIcon label="Workflows (coming soon)" disabled>
          🧩
        </NavIcon>
      </div>

      <div className="flex flex-col items-center gap-1">
        <NavIcon label="Help" disabled>
          ❓
        </NavIcon>
        <NavIcon label="Notifications" disabled>
          🔔
        </NavIcon>
        <NavIcon label="Settings" href="/dashboard/settings" active={onSettings}>
          ⚙️
        </NavIcon>
        <Link
          href="/dashboard/settings/profile"
          title={userEmail}
          className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
        >
          {initial}
        </Link>
      </div>
    </nav>
  );
}
