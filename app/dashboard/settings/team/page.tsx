"use client";

import { useCurrentUser } from "@/lib/useCurrentUser";
import { SettingsPage, SettingsCard, Badge, primaryButtonClass } from "../SettingsUI";

// ponytail: CoreOS is single-user per account right now — no organizations
// or invite table exists. This shows the signed-in user as sole Owner and
// leaves invites disabled until multi-user accounts are built.
export default function TeamPage() {
  const { user, loading } = useCurrentUser();

  return (
    <SettingsPage title="Team" description="Multi-seat workspaces aren't built yet — this shows your account only.">
      <SettingsCard title="Team Members">
        <div className="flex justify-end">
          <button disabled title="Invites require multi-user accounts" className={primaryButtonClass}>
            + Invite teammate
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : user ? (
          <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
            <div>
              <p className="text-sm text-neutral-100">{user.email}</p>
              <p className="text-xs text-neutral-500">
                Joined {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge>Owner</Badge>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Not signed in.</p>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
