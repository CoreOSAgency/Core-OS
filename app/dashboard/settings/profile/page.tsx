"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { SettingsPage, SettingsCard, inputClass, primaryButtonClass, secondaryButtonClass } from "../SettingsUI";

export default function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (user) setDisplayName((user.user_metadata?.display_name as string) ?? "");
  }, [user]);

  async function saveName() {
    setSavingName(true);
    setSavedName(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (!error) setSavedName(true);
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setPasswordMessage(error ? error.message : "✓ Password updated");
      if (!error) {
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) return <SettingsPage title="Profile"><p className="text-sm text-neutral-500">Loading…</p></SettingsPage>;

  return (
    <SettingsPage title="Profile">
      <SettingsCard title="Account">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="off"
            name="coreos-display-name"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Email</label>
          <input value={user?.email ?? ""} disabled className={`${inputClass} opacity-60`} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveName} disabled={savingName} className={primaryButtonClass}>
            {savingName ? "Saving…" : "Save"}
          </button>
          {savedName && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </SettingsCard>

      <SettingsCard title="Change Password">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
          className={inputClass}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className={inputClass}
        />
        <div className="flex items-center gap-2">
          <button onClick={changePassword} disabled={savingPassword} className={primaryButtonClass}>
            {savingPassword ? "Updating…" : "Update password"}
          </button>
          {passwordMessage && (
            <span className={`text-xs ${passwordMessage.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
              {passwordMessage}
            </span>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Profile Photo">
        <div className="flex items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-sm text-neutral-500">
              {(user?.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <label className={`${secondaryButtonClass} cursor-pointer`}>
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhoto(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>
        <p className="text-xs text-neutral-600">
          {/* ponytail: no storage bucket wired up — preview only, doesn't persist */}
          Preview only for now — no storage bucket wired up to persist it.
        </p>
      </SettingsCard>

      <SettingsCard title="Delete Account" description="Permanently deletes your account and all projects. This cannot be undone.">
        {!confirmingDelete ? (
          <button onClick={() => setConfirmingDelete(true)} className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950/40">
            Delete account
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-400">
              Account deletion needs an admin-level key this deployment doesn&apos;t have configured yet — nothing will happen if you confirm.
            </p>
            <div className="flex gap-2">
              <button disabled className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 opacity-50">
                Confirm delete
              </button>
              <button onClick={() => setConfirmingDelete(false)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsCard>

      <p className="text-xs text-neutral-600">
        <a href="https://github.com/CoreOSAgency/Core-OS" target="_blank" rel="noreferrer" className="hover:underline">
          Terms
        </a>
        {" · "}
        <a href="https://github.com/CoreOSAgency/Core-OS" target="_blank" rel="noreferrer" className="hover:underline">
          Privacy
        </a>
      </p>
    </SettingsPage>
  );
}
