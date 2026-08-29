"use client";

import { useState } from "react";
import { agentSections } from "@/lib/agents";
import { SettingsPage, SettingsCard, secondaryButtonClass } from "../SettingsUI";

// ponytail: no billing processor or usage-metering table exists yet — this
// page mirrors the target layout with static placeholder numbers instead of
// pretending to be connected to real spend. Wire up real metering + a
// payment processor before any of these numbers (or the buttons) go live.
const RANGE_DAYS: Record<string, number> = { Today: 1, "7 days": 7, "30 days": 30 };

export default function BillingPage() {
  const [range, setRange] = useState<"Today" | "7 days" | "30 days">("7 days");
  const days = RANGE_DAYS[range];
  const spend = (days * 0).toFixed(2); // no real usage recorded yet

  const agents = agentSections.flatMap((s) => s.agents);

  return (
    <SettingsPage title="Billing & Usage" description="Not yet connected to a payment processor or usage metering — layout only.">
      <SettingsCard title="Usage">
        <div className="flex gap-2">
          {(Object.keys(RANGE_DAYS) as (keyof typeof RANGE_DAYS)[]).map((label) => (
            <button
              key={label}
              onClick={() => setRange(label as typeof range)}
              className={`rounded-lg border px-3 py-1 text-xs ${
                range === label
                  ? "border-core-purple bg-core-purple/15 text-core-purple"
                  : "border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex h-24 items-end gap-1">
          {Array.from({ length: Math.min(days, 30) }).map((_, i) => (
            <div key={i} className="flex-1 rounded-t bg-core-purple/20" style={{ height: "6%" }} />
          ))}
        </div>
        <p className="text-xs text-neutral-500">${spend} spent — {range.toLowerCase()}</p>
      </SettingsCard>

      <SettingsCard title="AI usage by agent">
        <div className="space-y-2">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm">
              <span>{a.emoji}</span>
              <span className="w-20 shrink-0 text-neutral-300">{a.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-0 rounded-full bg-core-purple" />
              </div>
              <span className="w-12 shrink-0 text-right text-xs text-neutral-500">$0.00</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Storage & Hosting">
        <p className="text-sm text-neutral-400">Documents and Drive uploads — usage not yet metered.</p>
      </SettingsCard>

      <SettingsCard title="Billing">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Account credits</p>
            <p className="text-neutral-100">$0.00</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Payment method</p>
            <p className="text-neutral-100">Not connected</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Billing cycle</p>
            <p className="text-neutral-100">Monthly</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Monthly spend limit</p>
            <p className="text-neutral-100">Not set</p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button disabled title="No payment processor connected" className={secondaryButtonClass}>
            Add funds
          </button>
          <button disabled title="No payment processor connected" className={secondaryButtonClass}>
            Add payment method
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Receipts">
        <p className="text-sm text-neutral-500">No receipts yet.</p>
      </SettingsCard>
    </SettingsPage>
  );
}
