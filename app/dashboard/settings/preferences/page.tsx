"use client";

import { useEffect, useState } from "react";
import { SettingsPage, SettingsCard, inputClass } from "../SettingsUI";

const PREFS_KEY = "coreos_preferences";

type Prefs = { dateFormat: string; numberFormat: string; timezone: string };
const DEFAULT_PREFS: Prefs = { dateFormat: "MM/DD/YYYY", numberFormat: "1,000.00", timezone: "UTC" };

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London"];

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      // localStorage unavailable — defaults are fine
    }
  }, []);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaved(false);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      setSaved(true);
    } catch {
      // per-browser convenience only — fine if this silently fails
    }
  }

  return (
    <SettingsPage title="Preferences">
      <SettingsCard title="Model">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-sm text-neutral-100">Gemini 3.6 Flash</p>
            <p className="text-xs text-neutral-500">Powers every agent in CoreOS</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <div className="flex gap-2">
          <button className="rounded-lg border border-core-purple bg-core-purple/15 px-3 py-1.5 text-xs text-core-purple">
            Dark
          </button>
          <button disabled title="Coming soon" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-600">
            Light
          </button>
          <button disabled title="Coming soon" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-600">
            System
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Region & Time" description="Saved to this browser only.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Date format</label>
            <select value={prefs.dateFormat} onChange={(e) => update({ dateFormat: e.target.value })} className={inputClass}>
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Number format</label>
            <select value={prefs.numberFormat} onChange={(e) => update({ numberFormat: e.target.value })} className={inputClass}>
              <option>1,000.00</option>
              <option>1.000,00</option>
              <option>1 000,00</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Timezone</label>
            <select value={prefs.timezone} onChange={(e) => update({ timezone: e.target.value })} className={inputClass}>
              {TIMEZONES.map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        {saved && <p className="text-xs text-core-green">✓ Saved to this browser</p>}
      </SettingsCard>
    </SettingsPage>
  );
}
