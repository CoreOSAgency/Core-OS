"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "../../logout/actions";

const WORKSPACE_ITEMS = [
  { href: "/dashboard/settings/organization", label: "Organization" },
  { href: "/dashboard/settings/billing", label: "Billing & Retainers" },
  { href: "/dashboard/settings/reports", label: "Reports" },
  { href: "/dashboard/settings/integrations", label: "Integrations" },
  { href: "/dashboard/settings/domains", label: "Domains" },
  { href: "/dashboard/settings/team", label: "Team" },
  { href: "/dashboard/settings/api-access", label: "API Access" },
];

const USER_ITEMS = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/preferences", label: "Preferences" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-1.5 text-sm transition ${
        active ? "bg-core-purple/15 text-core-purple" : "text-neutral-300 hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}

export default function SettingsNav() {
  return (
    <nav className="flex h-full min-h-0 w-[240px] shrink-0 flex-col justify-between overflow-y-auto border-r border-white/5 bg-core-nav">
      <div className="px-2 py-4">
        <h2 className="px-3 pb-3 text-sm font-semibold text-neutral-100">Settings</h2>

        <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-core-gold/70">
          CURRENT WORKSPACE
        </p>
        <ul className="mb-4 space-y-0.5">
          {WORKSPACE_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink {...item} />
            </li>
          ))}
        </ul>

        <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-core-gold/70">
          USER
        </p>
        <ul className="space-y-0.5">
          {USER_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink {...item} />
            </li>
          ))}
        </ul>
      </div>

      <form action={signOut} className="px-2 pb-4">
        <button
          type="submit"
          className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
