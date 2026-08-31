"use client";

import Link from "next/link";

export type IconSection =
  | "dashboard"
  | "agency"
  | "clients"
  | "files"
  | "domains"
  | "workflows"
  | "settings";

// Small hand-rolled stroke icons — no icon library dependency for a dozen
// glyphs. 20x20 viewBox, currentColor stroke, 1.6 weight throughout.
const ICONS: Record<string, React.ReactNode> = {
  home: (
    <path
      d="M3 9.5 10 3l7 6.5M5 8v8.5a.5.5 0 0 0 .5.5H8v-5h4v5h2.5a.5.5 0 0 0 .5-.5V8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="3.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="11" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  people: (
    <>
      <circle cx="7.5" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="8.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 16c.5-3 2.5-4.5 5-4.5s4.5 1.5 5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 12c2 0 3.7 1.3 4.2 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  folder: (
    <path
      d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3l1.5 2H15A1.5 1.5 0 0 1 16.5 7.5v7A1.5 1.5 0 0 1 15 16H4.5A1.5 1.5 0 0 1 3 14.5v-9Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  ),
  globe: (
    <>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h14M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  nodes: (
    <>
      <circle cx="5" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.8 7.2 8.5 13M13.2 7.2 11.5 13M7 6h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  help: (
    <>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.8 8a2.2 2.2 0 1 1 3.4 1.8c-.8.5-1.2 1-1.2 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </>
  ),
  bell: (
    <path
      d="M6 8a4 4 0 1 1 8 0c0 3.5 1.2 4.5 1.2 4.5H4.8S6 11.5 6 8Z M8.3 15a1.8 1.8 0 0 0 3.4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  gear: (
    <>
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 3.5v1.8M10 14.7v1.8M16.5 10h-1.8M5.3 10H3.5M14.6 5.4l-1.3 1.3M6.7 13.3l-1.3 1.3M14.6 14.6l-1.3-1.3M6.7 6.7 5.4 5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20">
      {ICONS[name]}
    </svg>
  );
}

function NavIcon({
  label,
  active,
  disabled,
  onClick,
  icon,
  badge,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon: keyof typeof ICONS;
  badge?: boolean;
}) {
  // The active-state left border needs to sit flush against the sidebar's
  // own left edge, not the button's — the button is centered in a wider
  // column, so a border relative to the button alone would render outside
  // the sidebar (there's nothing to its left, it's the leftmost panel).
  return (
    <div className="relative flex w-full justify-center">
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-core-purple" />
      )}
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-current={active || undefined}
        onClick={disabled ? undefined : onClick}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
          active
            ? "bg-core-purple/15 text-core-purple"
            : disabled
              ? "cursor-default text-neutral-700"
              : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
        }`}
      >
        <Icon name={icon} />
        {badge && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-core-scarlet" />}
      </button>
    </div>
  );
}

export default function IconSidebar({
  active,
  onNavigate,
  userEmail,
  avatarUrl,
  notificationCount = 0,
}: {
  active: IconSection;
  onNavigate: (section: IconSection) => void;
  userEmail: string;
  avatarUrl?: string | null;
  notificationCount?: number;
}) {
  const initial = userEmail.trim().charAt(0).toUpperCase() || "?";

  return (
    <nav className="iridescent-rail flex h-full w-[50px] shrink-0 flex-col items-center justify-between border-r border-white/5 py-3">
      <div className="flex flex-col items-center gap-2">
        <Link
          href="/dashboard"
          title="CoreOS"
          className="sunbird-band mb-2 flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold tracking-tight text-[#111214] shadow-lg"
        >
          OSX
        </Link>
        <NavIcon label="Dashboard" icon="home" active={active === "dashboard"} onClick={() => onNavigate("dashboard")} />
        <NavIcon label="Agency" icon="grid" active={active === "agency"} onClick={() => onNavigate("agency")} />
        <NavIcon label="Clients" icon="people" active={active === "clients"} onClick={() => onNavigate("clients")} />
        <NavIcon label="Files" icon="folder" active={active === "files"} onClick={() => onNavigate("files")} />
        <NavIcon label="Domains" icon="globe" active={active === "domains"} onClick={() => onNavigate("domains")} />
        <NavIcon label="Workflows" icon="nodes" active={active === "workflows"} onClick={() => onNavigate("workflows")} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <NavIcon label="Help" icon="help" disabled />
        <NavIcon
          label={notificationCount > 0 ? `Notifications (${notificationCount})` : "Notifications"}
          icon="bell"
          disabled
          badge={notificationCount > 0}
        />
        <NavIcon label="Settings" icon="gear" active={active === "settings"} onClick={() => onNavigate("settings")} />
        <Link
          href="/dashboard/settings/profile"
          title={userEmail}
          className="mt-1 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </Link>
      </div>
    </nav>
  );
}
