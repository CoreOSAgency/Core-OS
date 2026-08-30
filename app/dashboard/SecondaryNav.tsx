"use client";

import type { Agent } from "@/lib/agents";
import AgentRosterList from "./AgentRosterList";
import type { IconSection } from "./IconSidebar";

export type AgencySubView = "overview" | "integrations" | "media" | "settings";

// Meta Ads/Google Ads/Static Ads/Landing Pages/Lead Scraper are next up —
// they're clickable and open an honest "not wired up yet" panel rather than
// a disabled dead-end. Sales Pipeline/Website Builder/Ads Manager are
// further out, so they keep the disabled SOON treatment.
const LIVE_TOOLS = ["Meta Ads", "Google Ads", "Static Ads", "Landing Pages", "Lead Scraper"];
const SOON_TOOLS = ["Sales Pipeline", "Website Builder", "Ads Manager"];

const AGENCY_SUB_ITEMS: { id: AgencySubView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "integrations", label: "Integrations" },
  { id: "media", label: "Media" },
  { id: "settings", label: "Settings" },
];

function SubNavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
        active ? "bg-core-purple/15 text-core-purple" : "text-neutral-300 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

export default function SecondaryNav({
  section,
  agencySubView,
  onAgencySubView,
  selectedAgentId,
  onSelectAgent,
  onToolClick,
}: {
  section: Exclude<IconSection, "workflows" | "settings">;
  agencySubView: AgencySubView;
  onAgencySubView: (v: AgencySubView) => void;
  selectedAgentId: string | null;
  onSelectAgent: (agent: Agent) => void;
  onToolClick: (tool: string) => void;
}) {
  return (
    <nav className="flex h-full min-h-0 w-[200px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-core-nav">
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold capitalize text-neutral-100">{section}</h2>
      </div>

      {section === "agency" && (
        <>
          <div className="space-y-0.5 px-2 pb-3">
            {AGENCY_SUB_ITEMS.map((item) => (
              <SubNavButton
                key={item.id}
                label={item.label}
                active={agencySubView === item.id}
                onClick={() => onAgencySubView(item.id)}
              />
            ))}
          </div>
          <div className="mx-4 mb-3 border-t border-white/5" />

          <div className="flex-1 space-y-4 px-2 pb-4">
            <AgentRosterList selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />

            <div>
              <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">TOOLS</p>
              <ul>
                {LIVE_TOOLS.map((tool) => (
                  <li key={tool}>
                    <button
                      onClick={() => onToolClick(tool)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-white/5"
                    >
                      {tool}
                    </button>
                  </li>
                ))}
                {SOON_TOOLS.map((tool) => (
                  <li key={tool}>
                    <button
                      disabled
                      title="Coming soon"
                      className="flex w-full cursor-default items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-neutral-500"
                    >
                      {tool}
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-neutral-500">
                        SOON
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {section === "clients" && (
        <div className="flex-1 px-2 pb-4">
          <button
            disabled
            title="Client records aren't built yet"
            className="mb-3 block w-full rounded-lg border border-core-purple/40 px-3 py-2 text-left text-sm text-core-purple/60"
          >
            + New client
          </button>
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">ALL CLIENTS</p>
          <p className="px-3 text-sm text-neutral-600">No clients yet.</p>
        </div>
      )}

      {section === "files" && (
        <div className="flex-1 px-2 pb-4">
          <p className="px-3 pb-1 text-[10px] font-semibold tracking-widest text-neutral-600">FOLDERS</p>
          <ul className="space-y-0.5">
            {["Agency", "Unfiled", "Trash"].map((f) => (
              <li key={f}>
                <button
                  disabled
                  title="File storage isn't built yet"
                  className="flex w-full cursor-default items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-neutral-500"
                >
                  📁 {f}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section === "domains" && (
        <div className="flex-1 px-2 pb-4">
          <button
            disabled
            title="Domain management isn't built yet"
            className="mb-3 block w-full rounded-lg border border-core-purple/40 px-3 py-2 text-left text-sm text-core-purple/60"
          >
            + Add domain
          </button>
          <p className="px-3 text-sm text-neutral-600">No domains yet.</p>
        </div>
      )}
    </nav>
  );
}
